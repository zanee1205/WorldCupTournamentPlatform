/**
 * generateLineups.ts
 *
 * Đọc collection `players` (đã import bởi importPlayers.ts),
 * tạo lineup mặc định cho từng đội và lưu vào collection `lineups`.
 *
 * Schema lineup:
 * {
 *   teamCode : "BRA",
 *   teamName : "Brazil",
 *   group    : "C",
 *   starters : [ { playerId, name, number, position, photo }, ... ] // 11 người
 *   bench    : [ ... ]  // phần còn lại
 *   formation: "4-3-3"  // mặc định, có thể override sau
 *   createdAt: Date
 * }
 *
 * Logic xếp đội hình mặc định (4-3-3):
 *  GK  × 1  → lấy người đầu tiên có pos === "GK"
 *  DEF × 4  → lấy 4 người đầu pos === "DEF"
 *  MID × 3  → lấy 3 người đầu pos === "MID"
 *  FWD × 3  → lấy 3 người đầu pos === "FWD"
 *
 * Nếu không đủ người ở một vị trí (dữ liệu thiếu) sẽ cảnh báo.
 *
 * Chạy:
 *   npx ts-node generateLineups.ts
 *   npx ts-node generateLineups.ts --formation=4-4-2
 */

import { MongoClient } from 'mongodb';

// ─── Config ───────────────────────────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME   = process.env.DB_NAME   || parseDbFromUri(MONGO_URI) || 'worldcup';

function parseDbFromUri(uri: string | undefined): string | null {
    if (!uri) return null;
    try {
        const path = new URL(uri).pathname.replace(/^\/+/, '');
        return path.split('/')[0] || null;
    } catch { return null; }
}

// ─── Formation parser ─────────────────────────────────────────────────────────

type Formation = { def: number; mid: number; fwd: number; label: string };

function parseFormation(): Formation {
    const arg = process.argv.find(a => a.startsWith('--formation='));
    const raw = arg ? arg.split('=')[1] : '4-3-3';
    const parts = raw.split('-').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) {
        console.warn(`⚠️  Formation "${raw}" không hợp lệ, dùng mặc định 4-3-3`);
        return { def: 4, mid: 3, fwd: 3, label: '4-3-3' };
    }
    return { def: parts[0], mid: parts[1], fwd: parts[2], label: raw };
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlayerDoc {
    playerId:  string;
    name:      string;
    number:    number | null;
    position:  string;  // GK / DEF / MID / FWD
    photo:     string;
    club:      string;
    teamCode:  string;
    teamName:  string;
    group:     string;
}

interface LineupPlayer {
    playerId: string;
    name:     string;
    number:   number | null;
    position: string;
    photo:    string;
}

interface LineupDoc {
    teamCode:  string;
    teamName:  string;
    group:     string;
    formation: string;
    starters:  LineupPlayer[];
    bench:     LineupPlayer[];
    createdAt: Date;
}

// ─── Build lineup từ danh sách cầu thủ ───────────────────────────────────────

function buildLineup(players: PlayerDoc[], formation: Formation): {
    starters: LineupPlayer[];
    bench: LineupPlayer[];
    warnings: string[];
} {
    const warnings: string[] = [];

    const byPos = (pos: string) => players.filter(p => p.position === pos);

    const pick = (pos: string, count: number): LineupPlayer[] => {
        const pool = byPos(pos);
        if (pool.length < count) {
            warnings.push(`Thiếu ${pos}: cần ${count}, có ${pool.length}`);
        }
        return pool.slice(0, count).map(p => ({
            playerId: p.playerId,
            name:     p.name,
            number:   p.number,
            position: p.position,
            photo:    p.photo,
        }));
    };

    const gk  = pick('GK',  1);
    const def = pick('DEF', formation.def);
    const mid = pick('MID', formation.mid);
    const fwd = pick('FWD', formation.fwd);

    const starters = [...gk, ...def, ...mid, ...fwd];
    const starterIds = new Set(starters.map(p => p.playerId));

    const bench: LineupPlayer[] = players
        .filter(p => !starterIds.has(p.playerId))
        .map(p => ({
            playerId: p.playerId,
            name:     p.name,
            number:   p.number,
            position: p.position,
            photo:    p.photo,
        }));

    return { starters, bench, warnings };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    const formation = parseFormation();

    console.log('══════════════════════════════════════════════════');
    console.log('  World Cup 2026 — Generate Lineups');
    console.log(`  Formation : ${formation.label}`);
    console.log(`  DB        : ${DB_NAME}`);
    console.log('══════════════════════════════════════════════════\n');

    const client = new MongoClient(MONGO_URI);

    try {
        await client.connect();
        console.log('✅ Kết nối MongoDB thành công');

        const db      = client.db(DB_NAME);
        const players = db.collection<PlayerDoc>('players');
        const lineups = db.collection<LineupDoc>('lineups');

        // Index
        await lineups.createIndex({ teamCode: 1 }, { unique: true });

        // Lấy tất cả team codes
        const teamCodes: string[] = await players.distinct('teamCode');
        console.log(`📋 Tìm thấy ${teamCodes.length} đội trong collection players\n`);

        if (teamCodes.length === 0) {
            console.error('❌ Không có cầu thủ nào trong DB. Chạy importPlayers.ts trước!');
            return;
        }

        let success = 0, failed = 0;

        for (const teamCode of teamCodes.sort()) {
            const teamPlayers = await players
                .find({ teamCode })
                .sort({ number: 1 })
                .toArray();

            if (teamPlayers.length === 0) continue;

            const teamName = teamPlayers[0].teamName;
            const group    = teamPlayers[0].group;

            const { starters, bench, warnings } = buildLineup(teamPlayers, formation);

            if (starters.length < 11) {
                console.log(`  ⚠️  [${group}] ${teamCode} ${teamName}: chỉ có ${starters.length}/11 starters`);
                warnings.forEach(w => console.log(`       → ${w}`));
                failed++;
            } else {
                console.log(`  ✅ [${group}] ${teamCode} ${teamName}: ${starters.length} starters, ${bench.length} bench`);
                success++;
            }

            const lineupDoc: LineupDoc = {
                teamCode,
                teamName,
                group,
                formation: formation.label,
                starters,
                bench,
                createdAt: new Date(),
            };

            await lineups.updateOne(
                { teamCode },
                { $set: lineupDoc },
                { upsert: true }
            );
        }

        console.log('\n══════════════════════════════════════');
        console.log(`📊  Lineup generation hoàn tất!`);
        console.log(`    Thành công : ${success} đội`);
        console.log(`    Cảnh báo   : ${failed} đội (thiếu cầu thủ)`);
        console.log(`    Formation  : ${formation.label}`);
        console.log('══════════════════════════════════════');

    } finally {
        await client.close();
        console.log('🔌 Đã đóng kết nối MongoDB');
    }
}

main().catch(err => {
    console.error('\n💥 Fatal error:', err);
    process.exit(1);
});