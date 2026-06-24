/**
 * importPlayers.ts (v5 — cache + resume)
 *
 * Thêm so với v4:
 *   - Bước 1 (Resolve IDs): cache kết quả ra scripts/team-ids-cache.json
 *       → lần sau đọc cache trước, chỉ gọi API cho đội chưa có trong cache
 *       → crash giữa bước search cũng không mất công
 *       → xoá file cache để resolve lại từ đầu: --clear-cache
 *   - Bước 2 (Fetch squad): ghi DB ngay sau mỗi đội + auto-resume
 *       → crash ở đội 40 → chạy lại → 39 đội đã có trong DB được skip tự động
 *       → chỉ fetch tiếp các đội còn thiếu
 *
 * Chiến lược lấy IDs:
 *   1. Đọc cache file (nếu có) → dùng ngay cho các đội đã cached
 *   2. GET /teams?league=1&season=2022  → 32 đội WC 2022 (cho đội chưa cached)
 *   3. GET /teams?search=<tên>          → các đội còn lại (cho đội chưa cached)
 *   4. Ghi cache sau mỗi lần resolve thành công
 *   5. GET /players/squads?team=<id>    → squad từng đội
 *   6. Upsert MongoDB ngay sau mỗi đội
 *
 * Chạy:
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/importPlayers.ts
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/importPlayers.ts --dry-run
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/importPlayers.ts --ids=Brazil,France
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/importPlayers.ts --force
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/importPlayers.ts --clear-cache
 */

import { MongoClient, Collection } from 'mongodb';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// __dirname không tồn tại trong ES module scope → tự tạo
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Config ───────────────────────────────────────────────────────────────────
const API_KEY = 'e2c0f942a21b59816609db54b7240167';
const BASE_URL = 'https://v3.football.api-sports.io';
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const DB_NAME = process.env.DB_NAME || 'tournament';

// Cache file lưu kết quả resolve team IDs — nằm cùng thư mục với script
const CACHE_FILE = path.resolve(__dirname, 'team-ids-cache.json');

// Free plan: 10 req/phút → 7s/req là an toàn
const REQ_DELAY_MS = 7_000;
const RETRY_DELAY_MS = 5_000;
const MAX_RETRIES = 3;

// ─── CLI ──────────────────────────────────────────────────────────────────────
const DRY_RUN = process.argv.includes('--dry-run');
// --force: bỏ qua auto-resume, fetch lại toàn bộ dù đội đã có data
const FORCE = process.argv.includes('--force');
// --clear-cache: xoá cache file team IDs, resolve lại từ đầu
const CLEAR_CACHE = process.argv.includes('--clear-cache');

const namesFilter: Set<string> | null = (() => {
    const arg = process.argv.find(a => a.startsWith('--ids='));
    if (!arg) return null;
    const names = arg.split('=')[1].split(',').map(s => s.trim().toLowerCase());
    return new Set(names);
})();

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

// ─── 48 đội WC 2026 ───────────────────────────────────────────────────────────
interface TeamDef {
    name: string;
    group: string;
    aliases?: string[];
}

const WC_2026_TEAMS: TeamDef[] = [
    { name: 'Mexico', group: 'A' },
    { name: 'South Africa', group: 'A' },
    { name: 'South Korea', group: 'A', aliases: ['Korea Republic'] },
    { name: 'Czech Republic', group: 'A', aliases: ['Czechia'] },
    { name: 'Canada', group: 'B' },
    { name: 'Bosnia & Herzegovina', group: 'B', aliases: ['Bosnia'] },
    { name: 'Qatar', group: 'B' },
    { name: 'Switzerland', group: 'B' },
    { name: 'Brazil', group: 'C' },
    { name: 'Morocco', group: 'C' },
    { name: 'Haiti', group: 'C' },
    { name: 'Scotland', group: 'C' },
    { name: 'USA', group: 'D', aliases: ['United States'] },
    { name: 'Paraguay', group: 'D' },
    { name: 'Australia', group: 'D' },
    { name: 'Türkiye', group: 'D', aliases: ['Turkey'] },
    { name: 'Germany', group: 'E' },
    { name: 'Curaçao', group: 'E', aliases: ['Curacao'] },
    { name: 'Ivory Coast', group: 'E', aliases: ["Cote d'Ivoire"] },
    { name: 'Ecuador', group: 'E' },
    { name: 'Netherlands', group: 'F' },
    { name: 'Japan', group: 'F' },
    { name: 'Sweden', group: 'F' },
    { name: 'Tunisia', group: 'F' },
    { name: 'Belgium', group: 'G' },
    { name: 'Egypt', group: 'G' },
    { name: 'Iran', group: 'G' },
    { name: 'New Zealand', group: 'G' },
    { name: 'Spain', group: 'H' },
    { name: 'Cape Verde', group: 'H' },
    { name: 'Saudi Arabia', group: 'H' },
    { name: 'Uruguay', group: 'H' },
    { name: 'France', group: 'I' },
    { name: 'Senegal', group: 'I' },
    { name: 'Iraq', group: 'I' },
    { name: 'Norway', group: 'I' },
    { name: 'Argentina', group: 'J' },
    { name: 'Algeria', group: 'J' },
    { name: 'Austria', group: 'J' },
    { name: 'Jordan', group: 'J' },
    { name: 'Portugal', group: 'K' },
    { name: 'DR Congo', group: 'K', aliases: ['Congo DR', 'Congo'] },
    { name: 'Uzbekistan', group: 'K' },
    { name: 'Colombia', group: 'K' },
    { name: 'England', group: 'L' },
    { name: 'Croatia', group: 'L' },
    { name: 'Ghana', group: 'L' },
    { name: 'Panama', group: 'L' },
];

const FIFA_CODE: Record<string, string> = {
    'Mexico': 'MEX', 'South Africa': 'RSA', 'South Korea': 'KOR', 'Czech Republic': 'CZE',
    'Canada': 'CAN', 'Bosnia & Herzegovina': 'BIH', 'Qatar': 'QAT', 'Switzerland': 'SUI',
    'Brazil': 'BRA', 'Morocco': 'MAR', 'Haiti': 'HAI', 'Scotland': 'SCO',
    'USA': 'USA', 'Paraguay': 'PAR', 'Australia': 'AUS', 'Türkiye': 'TUR',
    'Germany': 'GER', 'Curaçao': 'CUW', 'Ivory Coast': 'CIV', 'Ecuador': 'ECU',
    'Netherlands': 'NED', 'Japan': 'JPN', 'Sweden': 'SWE', 'Tunisia': 'TUN',
    'Belgium': 'BEL', 'Egypt': 'EGY', 'Iran': 'IRN', 'New Zealand': 'NZL',
    'Spain': 'ESP', 'Cape Verde': 'CPV', 'Saudi Arabia': 'KSA', 'Uruguay': 'URU',
    'France': 'FRA', 'Senegal': 'SEN', 'Iraq': 'IRQ', 'Norway': 'NOR',
    'Argentina': 'ARG', 'Algeria': 'ALG', 'Austria': 'AUT', 'Jordan': 'JOR',
    'Portugal': 'POR', 'DR Congo': 'COD', 'Uzbekistan': 'UZB', 'Colombia': 'COL',
    'England': 'ENG', 'Croatia': 'CRO', 'Ghana': 'GHA', 'Panama': 'PAN',
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface ApiTeam {
    team: { id: number; name: string; national: boolean };
}

interface ApiSquadPlayer {
    id: number;
    name: string;
    age: number | null;
    number: number | null;
    pos?: string | null;
    position?: string | null;
    photo: string;
}

interface PlayerDocument {
    playerId: string;
    apiId: number;
    name: string;
    number: number | null;
    position: string;
    photo: string;
    age: number | null;
    // detail fields — null cho đến khi upgrade plan
    firstName: null;
    lastName: null;
    birthDate: null;
    birthPlace: null;
    birthCountry: null;
    nationality: null;
    height: null;
    weight: null;
    club: null;
    // team info
    teamCode: string;
    teamName: string;
    teamId: number;
    group: string;
    createdAt: Date;
    updatedAt: Date;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function slugify(s: string): string {
    return s.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
}

function normalizePosition(pos: string | null | undefined): string {
    if (!pos) return 'NA';
    const map: Record<string, string> = {
        'G': 'GK', 'GK': 'GK', 'Goalkeeper': 'GK',
        'D': 'DF', 'DF': 'DF', 'Defender': 'DF',
        'M': 'MF', 'MF': 'MF', 'Midfielder': 'MF',
        'F': 'FW', 'FW': 'FW', 'Attacker': 'FW', 'Forward': 'FW',
    };
    return map[pos] ?? 'NA';
}

// Strip các field null khỏi object để tránh ghi đè data đã có
function stripNulls<T extends object>(obj: T): Partial<T> {
    return Object.fromEntries(
        Object.entries(obj).filter(([, v]) => v !== null && v !== undefined)
    ) as Partial<T>;
}

// ─── API ──────────────────────────────────────────────────────────────────────
const HEADERS = { 'x-apisports-key': API_KEY, 'Accept': 'application/json' };

async function apiFetch<T>(endpoint: string, attempt = 1): Promise<T> {
    let res: Response;
    try {
        res = await fetch(`${BASE_URL}${endpoint}`, { headers: HEADERS });
    } catch (networkErr) {
        if (attempt < MAX_RETRIES) {
            console.log(`\n   ⚠️  Network error, retry ${attempt}/${MAX_RETRIES} sau ${RETRY_DELAY_MS / 1000}s...`);
            await sleep(RETRY_DELAY_MS);
            return apiFetch(endpoint, attempt + 1);
        }
        throw networkErr;
    }

    const remaining = res.headers.get('X-RateLimit-requests-Remaining');
    if (remaining) process.stdout.write(`[quota:${remaining}] `);

    if (res.status === 429) {
        if (attempt < MAX_RETRIES) {
            console.log(`\n   ⚠️  Rate limit 429, retry ${attempt}/${MAX_RETRIES} sau 60s...`);
            await sleep(60_000);
            return apiFetch(endpoint, attempt + 1);
        }
        throw new Error('Rate limit — đã retry đủ lần, đợi 1 phút rồi chạy lại');
    }

    if (!res.ok) throw new Error(`HTTP ${res.status} — ${endpoint}`);

    const json = await res.json();

    // API-Sports trả lỗi trong json.errors (object) HOẶC json.message (string)
    if (json.errors && typeof json.errors === 'object' && Object.keys(json.errors).length > 0) {
        throw new Error(Object.entries(json.errors).map(([k, v]) => `${k}: ${v}`).join(', '));
    }
    if (json.message && typeof json.message === 'string') {
        throw new Error(json.message);
    }

    return json as T;
}

// ─── Team ID Cache ────────────────────────────────────────────────────────────
// Lưu dạng: { "Brazil": { id: 6, apiName: "Brazil" }, ... }
type CacheEntry = { id: number; apiName: string };
type CacheMap = Record<string, CacheEntry>;

function readCache(): CacheMap {
    if (!fs.existsSync(CACHE_FILE)) return {};
    try {
        const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
        return JSON.parse(raw) as CacheMap;
    } catch {
        console.log('  ⚠️  Cache file bị lỗi, bỏ qua và resolve lại.');
        return {};
    }
}

function writeCache(cache: CacheMap): void {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8');
}

// ─── BƯỚC 1: Lấy IDs ─────────────────────────────────────────────────────────
async function fetchWC2022Teams(): Promise<Map<string, number>> {
    console.log('📡 GET /teams?league=1&season=2022 ...');
    const data = await apiFetch<{ response: ApiTeam[] }>('/teams?league=1&season=2022');
    console.log(`   → ${data.response.length} đội\n`);

    const map = new Map<string, number>();
    for (const item of data.response) {
        map.set(item.team.name.toLowerCase(), item.team.id);
    }
    return map;
}

async function searchNationalTeam(
    teamDef: TeamDef
): Promise<{ id: number; apiName: string } | null> {
    const queriesToTry = [teamDef.name, ...(teamDef.aliases ?? [])];

    for (const q of queriesToTry) {
        await sleep(REQ_DELAY_MS);
        process.stdout.write(`   🔍 search "${q}" `);

        // API chỉ nhận alpha-numeric + spaces
        const sanitized = q.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9 ]/g, ' ').trim();
        if (!sanitized) {
            console.log(`→ skip (tên không hợp lệ sau khi sanitize)`);
            continue;
        }

        try {
            const data = await apiFetch<{ response: ApiTeam[] }>(
                `/teams?search=${encodeURIComponent(sanitized)}`
            );

            const nationals = data.response.filter(t => t.team.national === true);
            console.log(`→ ${nationals.length} national team(s)`);

            if (nationals.length === 0) continue;

            const norm = (s: string) =>
                s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, '').trim();

            const exact = nationals.find(t =>
                [teamDef.name, ...(teamDef.aliases ?? [])].some(
                    alias => norm(alias) === norm(t.team.name)
                )
            );

            if (exact) return { id: exact.team.id, apiName: exact.team.name };
            if (nationals.length === 1) return { id: nationals[0].team.id, apiName: nationals[0].team.name };

            console.log(`   ⚠️  Nhiều kết quả: ${nationals.map(t => `${t.team.id}:"${t.team.name}"`).join(', ')}`);
            console.log(`   → Dùng: ${nationals[0].team.id} "${nationals[0].team.name}"`);
            return { id: nationals[0].team.id, apiName: nationals[0].team.name };

        } catch (err) {
            console.log(`→ lỗi: ${(err as Error).message}`);
        }
    }

    return null;
}

async function resolveAllTeamIds(
    teams: TeamDef[]
): Promise<Array<TeamDef & { id: number; apiName: string }>> {
    console.log('══════════════════════════════════════════════');
    console.log('BƯỚC 1: Resolve team IDs');
    console.log('══════════════════════════════════════════════');

    // ── Xử lý --clear-cache ───────────────────────────────────────────────────
    if (CLEAR_CACHE && fs.existsSync(CACHE_FILE)) {
        fs.unlinkSync(CACHE_FILE);
        console.log('  🗑️  Đã xoá cache file. Resolve lại từ đầu.\n');
    }

    // ── Đọc cache ─────────────────────────────────────────────────────────────
    const cache = readCache();
    const cachedCount = Object.keys(cache).length;
    if (cachedCount > 0) {
        console.log(`  📦 Cache: ${cachedCount} đội đã có ID (${CACHE_FILE})`);
    }

    // Phân loại: đội nào đã cached, đội nào chưa
    const resolved: Array<TeamDef & { id: number; apiName: string }> = [];
    const needApi: TeamDef[] = [];

    for (const team of teams) {
        const cached = cache[team.name];
        if (cached) {
            console.log(`  ✅ [${team.group}] ${team.name.padEnd(26)} → id=${cached.id} (cache)`);
            resolved.push({ ...team, id: cached.id, apiName: cached.apiName });
        } else {
            needApi.push(team);
        }
    }

    // Nếu tất cả đã có trong cache → xong ngay, không tốn quota
    if (needApi.length === 0) {
        console.log(`\n  ✨ Toàn bộ ${resolved.length} đội lấy từ cache — không tốn quota.\n`);
        return resolved;
    }

    console.log(`\n  🌐 ${needApi.length} đội chưa có cache, cần gọi API:\n`);

    // ── Gọi API cho các đội chưa cached ──────────────────────────────────────
    // Lấy WC2022 map (1 request duy nhất) nếu còn đội cần resolve
    await sleep(REQ_DELAY_MS);
    const wc2022Map = await fetchWC2022Teams();

    const norm = (s: string) =>
        s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, '').trim();

    const needSearch: TeamDef[] = [];

    for (const team of needApi) {
        const namesToTry = [team.name, ...(team.aliases ?? [])];
        let found: { id: number; apiName: string } | null = null;

        for (const n of namesToTry) {
            const id = wc2022Map.get(norm(n));
            if (id) {
                found = { id, apiName: n };
                break;
            }
        }

        if (found) {
            console.log(`  ✅ [${team.group}] ${team.name.padEnd(26)} → id=${found.id} (WC2022)`);
            resolved.push({ ...team, ...found });
            // Lưu vào cache ngay
            cache[team.name] = { id: found.id, apiName: found.apiName };
            writeCache(cache);
        } else {
            needSearch.push(team);
        }
    }

    if (needSearch.length > 0) {
        console.log(`\n  🔍 ${needSearch.length} đội cần search thêm:\n`);
        for (const team of needSearch) {
            process.stdout.write(`  [${team.group}] ${team.name.padEnd(26)} `);
            const result = await searchNationalTeam(team);
            if (result) {
                console.log(`  ✅ → id=${result.id} "${result.apiName}"`);
                resolved.push({ ...team, ...result });
                // Lưu vào cache ngay sau khi search thành công
                cache[team.name] = { id: result.id, apiName: result.apiName };
                writeCache(cache);
            } else {
                console.log(`  ❌ Không tìm được ID — bỏ qua đội này`);
            }
        }
    }

    console.log(`\n  Resolve xong: ${resolved.length}/${teams.length} đội`);
    console.log(`  Cache đã lưu: ${CACHE_FILE}\n`);
    return resolved;
}

// ─── BƯỚC 2: Lấy squad ───────────────────────────────────────────────────────
async function fetchSquad(teamId: number): Promise<{
    players: ApiSquadPlayer[];
    apiTeamName: string | null;
}> {
    const data = await apiFetch<{
        response: Array<{
            team: { id: number; name: string };
            players: ApiSquadPlayer[];
        }>;
    }>(`/players/squads?team=${teamId}`);

    if (!data.response?.length) return { players: [], apiTeamName: null };

    const first = data.response[0];
    return {
        players: first.players ?? [],
        apiTeamName: first.team?.name ?? null,
    };
}

// ─── BƯỚC 3: Ghi MongoDB (từng đội, ngay sau khi fetch) ──────────────────────
/**
 * FIX CHÍNH: Tách createdAt ra khỏi $set.
 *
 * Vấn đề v3: { $setOnInsert: { createdAt }, $set: { ...doc } }
 *   → doc chứa createdAt → MongoDB báo "conflict at createdAt"
 *
 * Fix: destructure doc, tách createdAt + updatedAt ra ngoài, chỉ $set các
 * field còn lại (không null) + updatedAt riêng.
 */
async function upsertTeamPlayers(
    col: Collection<PlayerDocument>,
    docs: PlayerDocument[]
): Promise<{ inserted: number; updated: number; unchanged: number }> {
    let inserted = 0, updated = 0, unchanged = 0;
    const now = new Date();

    for (const doc of docs) {
        // Destructure để loại bỏ createdAt, updatedAt khỏi $set
        const { createdAt, updatedAt: _updatedAt, ...rest } = doc;

        // Loại bỏ các field null để không ghi đè dữ liệu tốt đã có
        const setFields = stripNulls(rest);

        const r = await col.updateOne(
            { playerId: doc.playerId },
            {
                $setOnInsert: { createdAt },   // chỉ set khi INSERT lần đầu
                $set: {
                    ...setFields,              // các field non-null
                    updatedAt: now,            // luôn cập nhật timestamp
                },
            },
            { upsert: true }
        );

        if (r.upsertedCount > 0) inserted++;
        else if (r.modifiedCount > 0) updated++;
        else unchanged++;
    }

    return { inserted, updated, unchanged };
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
    console.log('══════════════════════════════════════════════════');
    console.log('  World Cup 2026 — importPlayers v5');
    console.log(`  DB    : ${DB_NAME} @ ${MONGO_URI}`);
    console.log(`  Cache : ${CACHE_FILE}`);
    console.log(`  Flags : ${[DRY_RUN && 'DRY-RUN', FORCE && 'FORCE', CLEAR_CACHE && 'CLEAR-CACHE'].filter(Boolean).join(', ') || 'none'}`);
    console.log('══════════════════════════════════════════════════\n');

    const teamsToProcess = namesFilter
        ? WC_2026_TEAMS.filter(t =>
            namesFilter.has(t.name.toLowerCase()) ||
            (t.aliases ?? []).some(a => namesFilter.has(a.toLowerCase()))
        )
        : WC_2026_TEAMS;

    // ── Kết nối MongoDB sớm để kiểm tra resume ────────────────────────────────
    let client: MongoClient | null = null;
    let col: Collection<PlayerDocument> | null = null;

    if (!DRY_RUN) {
        client = new MongoClient(MONGO_URI);
        await client.connect();
        console.log('✅ Kết nối MongoDB\n');

        col = client.db(DB_NAME).collection<PlayerDocument>('players');

        // Tạo indexes
        await col.createIndex({ playerId: 1 }, { unique: true });
        await col.createIndex({ teamId: 1 });
        await col.createIndex({ teamCode: 1 });
        await col.createIndex({ group: 1 });
        await col.createIndex({ name: 'text' });
    }

    try {
        // ── Bước 1: Resolve IDs ───────────────────────────────────────────────
        const resolvedTeams = await resolveAllTeamIds(teamsToProcess);

        if (resolvedTeams.length === 0) {
            console.log('❌ Không resolve được đội nào.');
            return;
        }

        // ── Bước 2 + 3: Fetch squad → ghi DB ngay từng đội ───────────────────
        console.log('══════════════════════════════════════════════');
        console.log('BƯỚC 2+3: Fetch squads & Upsert MongoDB');
        console.log(`  ${resolvedTeams.length} đội × ~${REQ_DELAY_MS / 1000}s = ~${Math.ceil(resolvedTeams.length * REQ_DELAY_MS / 60_000)} phút`);
        console.log('══════════════════════════════════════════════\n');

        let totalInserted = 0, totalUpdated = 0, totalUnchanged = 0;
        let successCount = 0, skipCount = 0, errorCount = 0;
        const now = new Date();

        for (let i = 0; i < resolvedTeams.length; i++) {
            const team = resolvedTeams[i];
            const teamCode = FIFA_CODE[team.name] ?? team.name.slice(0, 3).toUpperCase();
            const progress = `[${String(i + 1).padStart(2)}/${resolvedTeams.length}]`;

            // ── Auto-resume: skip nếu đội đã có data (trừ khi --force) ────────
            if (!FORCE && col) {
                const existingCount = await col.countDocuments({ teamId: team.id });
                if (existingCount > 0) {
                    console.log(`${progress} [${team.group}] ${team.name.padEnd(24)} → ⏭️  SKIP (đã có ${existingCount} cầu thủ trong DB)`);
                    skipCount++;
                    continue;
                }
            }

            process.stdout.write(`${progress} [${team.group}] ${team.name.padEnd(24)} id=${team.id} `);

            await sleep(REQ_DELAY_MS);

            try {
                const { players, apiTeamName } = await fetchSquad(team.id);
                process.stdout.write(`→ ${players.length} cầu thủ  [API:"${apiTeamName}"] `);

                if (players.length === 0) {
                    console.log('⚠️  Squad trống');
                    errorCount++;
                    continue;
                }

                // Build documents
                const docs: PlayerDocument[] = players.map(p => {
                    const rawPos = p.pos ?? p.position ?? null;
                    return {
                        playerId: `${teamCode.toLowerCase()}_${slugify(p.name)}`,
                        apiId: p.id,
                        name: p.name,
                        number: p.number ?? null,
                        position: normalizePosition(rawPos),
                        photo: p.photo ?? '',
                        age: p.age ?? null,
                        firstName: null,
                        lastName: null,
                        birthDate: null,
                        birthPlace: null,
                        birthCountry: null,
                        nationality: null,
                        height: null,
                        weight: null,
                        club: null,
                        teamCode,
                        teamName: team.name,
                        teamId: team.id,
                        group: team.group,
                        createdAt: now,
                        updatedAt: now,
                    };
                });

                if (DRY_RUN) {
                    console.log('(DRY-RUN, không ghi)');
                    successCount++;
                    continue;
                }

                // Ghi ngay sau khi fetch xong đội này
                const stats = await upsertTeamPlayers(col!, docs);
                totalInserted += stats.inserted;
                totalUpdated += stats.updated;
                totalUnchanged += stats.unchanged;
                successCount++;

                console.log(`✅ +${stats.inserted} ins / ${stats.updated} upd / ${stats.unchanged} unch`);

            } catch (err) {
                const msg = (err as Error).message;
                console.log(`❌ ${msg}`);
                errorCount++;

                // Nếu hết quota → dừng ngay, tránh tiêu hết quota còn lại
                if (msg.toLowerCase().includes('request limit') || msg.toLowerCase().includes('quota')) {
                    console.log('\n⛔ Đã hết quota ngày hôm nay. Chạy lại script vào ngày mai.');
                    console.log('   Script sẽ tự skip các đội đã có data (auto-resume).');
                    break;
                }
            }
        }

        // ── Tổng kết ──────────────────────────────────────────────────────────
        const total = col ? await col.countDocuments() : 'N/A';

        console.log('\n══════════════════════════════════════════════');
        console.log('📊  Kết quả');
        console.log(`    Thành công : ${successCount}`);
        console.log(`    Bỏ qua     : ${skipCount} (đã có data)`);
        console.log(`    Lỗi        : ${errorCount}`);

        if (!DRY_RUN) {
            console.log(`    Inserted   : ${totalInserted}`);
            console.log(`    Updated    : ${totalUpdated}`);
            console.log(`    Unchanged  : ${totalUnchanged}`);
            console.log(`    Tổng DB    : ${total} cầu thủ`);
        } else {
            console.log('    (DRY-RUN — không có gì được ghi)');
        }
        console.log('══════════════════════════════════════════════');

    } finally {
        // Đảm bảo luôn đóng connection dù có lỗi hay không
        if (client) {
            await client.close();
            console.log('🔌 Đóng MongoDB connection');
        }
    }
}

main().catch(err => {
    console.error('\n💥 Fatal:', err.message ?? err);
    process.exit(1);
});