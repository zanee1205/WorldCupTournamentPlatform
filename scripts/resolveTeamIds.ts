/**
 * resolveTeamIds.ts
 *
 * Tự động tìm đúng team ID quốc gia từ API-Football bằng cách
 * search theo tên, rồi lọc `national: true`.
 *
 * Chạy:
 *   npx tsx scripts/resolveTeamIds.ts                  # resolve toàn bộ 48 đội
 *   npx tsx scripts/resolveTeamIds.ts --ids=Brazil,Spain  # chỉ resolve đội chỉ định
 *   npx tsx scripts/resolveTeamIds.ts --out=teamIds.json  # xuất JSON
 *
 * Output:
 *   - In ra bảng so sánh ID cũ vs ID mới tìm được
 *   - (optional) Ghi file JSON để paste vào WC_2026_TEAMS
 *
 * Rate limit: 1 request/đội → 48 req, free plan 10 req/phút
 *   → delay 7s/đội ≈ 6 phút tổng
 */

// ─── Config ───────────────────────────────────────────────────────────────────
const API_KEY  = 'faaeef66f580ff96d0c47bc7309e182d';
const BASE_URL = 'https://v3.football.api-sports.io';

const DELAY_MS = 7_000; // 7s/req → ~8.5 req/phút (dưới giới hạn 10)

// ─── 48 đội WC 2026 — tên chính xác theo FIFA / Wikipedia ───────────────────
// Thêm aliases để search rộng hơn khi API dùng tên khác
interface TeamEntry {
    name: string;         // Tên hiển thị
    group: string;
    aliases?: string[];   // Tên thay thế để thử nếu search chính fail
    currentId: number;    // ID đang dùng trong importPlayers.ts (để so sánh)
}

const WC_2026_TEAMS: TeamEntry[] = [
    // Group A
    { name: 'Mexico',               group: 'A', currentId: 768 },
    { name: 'South Africa',         group: 'A', currentId: 767 },
    { name: 'South Korea',          group: 'A', aliases: ['Korea Republic'], currentId: 65 },
    { name: 'Czech Republic',       group: 'A', aliases: ['Czechia'], currentId: 770 },
    // Group B
    { name: 'Canada',               group: 'B', currentId: 755 },
    { name: 'Bosnia & Herzegovina', group: 'B', aliases: ['Bosnia'], currentId: 652 },
    { name: 'Qatar',                group: 'B', currentId: 819 },
    { name: 'Switzerland',          group: 'B', currentId: 3 },
    // Group C
    { name: 'Brazil',               group: 'C', currentId: 9 },
    { name: 'Morocco',              group: 'C', currentId: 6 },
    { name: 'Haiti',                group: 'C', currentId: 514 },
    { name: 'Scotland',             group: 'C', currentId: 1020 },
    // Group D
    { name: 'United States',        group: 'D', aliases: ['USA', 'US'], currentId: 1526 },
    { name: 'Paraguay',             group: 'D', currentId: 89 },
    { name: 'Australia',            group: 'D', currentId: 25 },
    { name: 'Turkey',               group: 'D', aliases: ['Türkiye'], currentId: 778 },
    // Group E
    { name: 'Germany',              group: 'E', currentId: 15 },
    { name: 'Curacao',              group: 'E', aliases: ['Curaçao'], currentId: 1572 },
    { name: 'Ivory Coast',          group: 'E', aliases: ["Côte d'Ivoire", 'Cote d\'Ivoire'], currentId: 20 },
    { name: 'Ecuador',              group: 'E', currentId: 756 },
    // Group F
    { name: 'Netherlands',          group: 'F', currentId: 1140 },
    { name: 'Japan',                group: 'F', currentId: 775 },
    { name: 'Sweden',               group: 'F', currentId: 660 },
    { name: 'Tunisia',              group: 'F', currentId: 47 },
    // Group G
    { name: 'Belgium',              group: 'G', currentId: 1 },
    { name: 'Egypt',                group: 'G', currentId: 107 },
    { name: 'Iran',                 group: 'G', currentId: 34 },
    { name: 'New Zealand',          group: 'G', currentId: 21 },
    // Group H
    { name: 'Spain',                group: 'H', currentId: 17 },
    { name: 'Cape Verde',           group: 'H', currentId: 1039 },
    { name: 'Saudi Arabia',         group: 'H', currentId: 56 },
    { name: 'Uruguay',              group: 'H', currentId: 24 },
    // Group I
    { name: 'France',               group: 'I', currentId: 2 },
    { name: 'Senegal',              group: 'I', currentId: 113 },
    { name: 'Iraq',                 group: 'I', currentId: 95 },
    { name: 'Norway',               group: 'I', currentId: 1033 },
    // Group J
    { name: 'Argentina',            group: 'J', currentId: 26 },
    { name: 'Algeria',              group: 'J', currentId: 45 },
    { name: 'Austria',              group: 'J', currentId: 776 },
    { name: 'Jordan',               group: 'J', currentId: 167 },
    // Group K
    { name: 'Portugal',             group: 'K', currentId: 5 },
    { name: 'DR Congo',             group: 'K', aliases: ['Congo DR', 'Democratic Republic of Congo'], currentId: 116 },
    { name: 'Uzbekistan',           group: 'K', currentId: 2417 },
    { name: 'Colombia',             group: 'K', currentId: 22 },
    // Group L
    { name: 'England',              group: 'L', currentId: 10 },
    { name: 'Croatia',              group: 'L', currentId: 157 },
    { name: 'Ghana',                group: 'L', currentId: 91 },
    { name: 'Panama',               group: 'L', currentId: 763 },
];

// ─── CLI ──────────────────────────────────────────────────────────────────────
const namesFilter = (() => {
    const arg = process.argv.find(a => a.startsWith('--ids='));
    if (!arg) return null;
    const names = arg.split('=')[1].split(',').map(s => s.trim().toLowerCase());
    return new Set(names);
})();

const outFile = (() => {
    const arg = process.argv.find(a => a.startsWith('--out='));
    return arg ? arg.split('=')[1] : null;
})();

// ─── API ──────────────────────────────────────────────────────────────────────
const API_HEADERS = {
    'x-apisports-key': API_KEY,
    'Accept': 'application/json',
};

interface ApiTeam {
    team: {
        id: number;
        name: string;
        national: boolean;
        logo: string;
    };
    venue?: unknown;
}

async function searchTeam(query: string): Promise<ApiTeam[]> {
    const url = `${BASE_URL}/teams?search=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: API_HEADERS });

    if (res.status === 429) throw new Error('Rate limit hit — đợi 1 phút rồi chạy lại');
    if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);

    const json = await res.json();

    if (json.errors && Object.keys(json.errors).length > 0) {
        const msg = Object.entries(json.errors).map(([k, v]) => `${k}: ${v}`).join(', ');
        throw new Error(`API error: ${msg}`);
    }

    return (json.response ?? []) as ApiTeam[];
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

// ─── Resolve một đội ─────────────────────────────────────────────────────────
interface ResolveResult {
    name: string;
    group: string;
    currentId: number;
    resolvedId: number | null;
    resolvedName: string | null;
    status: 'ok' | 'changed' | 'not_found' | 'ambiguous' | 'error';
    candidates: Array<{ id: number; name: string }>;
    error?: string;
}

async function resolveTeam(team: TeamEntry): Promise<ResolveResult> {
    const queriesToTry = [team.name, ...(team.aliases ?? [])];

    let allCandidates: ApiTeam[] = [];
    let lastError: string | undefined;

    for (const q of queriesToTry) {
        try {
            const results = await searchTeam(q);
            // Chỉ giữ lại national teams
            const nationals = results.filter(r => r.team.national === true);
            allCandidates.push(...nationals);
            if (nationals.length > 0) break; // Tìm thấy rồi, không cần thử alias
        } catch (err) {
            lastError = (err as Error).message;
            if (lastError.includes('Rate limit')) throw err; // propagate 429
        }
        await sleep(500); // nhỏ delay giữa alias queries
    }

    // Dedup by id
    const seen = new Set<number>();
    allCandidates = allCandidates.filter(c => {
        if (seen.has(c.team.id)) return false;
        seen.add(c.team.id);
        return true;
    });

    const base: Pick<ResolveResult, 'name' | 'group' | 'currentId' | 'candidates'> = {
        name:       team.name,
        group:      team.group,
        currentId:  team.currentId,
        candidates: allCandidates.map(c => ({ id: c.team.id, name: c.team.name })),
    };

    if (allCandidates.length === 0) {
        return { ...base, resolvedId: null, resolvedName: null,
            status: lastError ? 'error' : 'not_found', error: lastError };
    }

    // Tìm exact match (case-insensitive)
    const searchNames = [team.name, ...(team.aliases ?? [])].map(s => s.toLowerCase());
    const exact = allCandidates.find(c => searchNames.includes(c.team.name.toLowerCase()));

    if (exact) {
        const changed = exact.team.id !== team.currentId;
        return {
            ...base,
            resolvedId:   exact.team.id,
            resolvedName: exact.team.name,
            status:       changed ? 'changed' : 'ok',
        };
    }

    // Nếu chỉ 1 kết quả national team
    if (allCandidates.length === 1) {
        const c = allCandidates[0];
        return {
            ...base,
            resolvedId:   c.team.id,
            resolvedName: c.team.name,
            status:       c.team.id !== team.currentId ? 'changed' : 'ok',
        };
    }

    // Nhiều kết quả, không rõ cái nào đúng
    return {
        ...base,
        resolvedId:   null,
        resolvedName: null,
        status: 'ambiguous',
    };
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
    const teams = namesFilter
        ? WC_2026_TEAMS.filter(t =>
            namesFilter.has(t.name.toLowerCase()) ||
            (t.aliases ?? []).some(a => namesFilter.has(a.toLowerCase()))
          )
        : WC_2026_TEAMS;

    console.log('═══════════════════════════════════════════════════════');
    console.log('  resolveTeamIds — World Cup 2026');
    console.log(`  Đội cần resolve: ${teams.length}`);
    console.log(`  Delay: ${DELAY_MS}ms/đội`);
    console.log(`  ETA: ~${Math.ceil(teams.length * DELAY_MS / 60_000)} phút`);
    console.log('═══════════════════════════════════════════════════════\n');

    const results: ResolveResult[] = [];

    for (let i = 0; i < teams.length; i++) {
        const team = teams[i];
        const isLast = i === teams.length - 1;
        const progress = `[${String(i + 1).padStart(2)}/${teams.length}]`;

        process.stdout.write(`${progress} ${team.name.padEnd(28)} `);

        try {
            const r = await resolveTeam(team);
            results.push(r);

            const icon =
                r.status === 'ok'        ? '✅' :
                r.status === 'changed'   ? '🔄' :
                r.status === 'ambiguous' ? '⚠️ ' :
                r.status === 'not_found' ? '❌' : '💥';

            if (r.status === 'ok') {
                console.log(`${icon} id=${r.resolvedId} — khớp`);
            } else if (r.status === 'changed') {
                console.log(`${icon} id=${r.currentId} → ${r.resolvedId} "${r.resolvedName}"`);
            } else if (r.status === 'ambiguous') {
                console.log(`${icon} nhiều kết quả: ${r.candidates.map(c => `${c.id}:"${c.name}"`).join(', ')}`);
            } else if (r.status === 'not_found') {
                console.log(`${icon} không tìm thấy national team`);
            } else {
                console.log(`${icon} lỗi: ${r.error}`);
            }
        } catch (err) {
            console.log(`💥 Fatal: ${(err as Error).message}`);
            process.exit(1);
        }

        if (!isLast) await sleep(DELAY_MS);
    }

    // ── Tổng kết ──────────────────────────────────────────────────────────────
    const ok        = results.filter(r => r.status === 'ok').length;
    const changed   = results.filter(r => r.status === 'changed');
    const ambiguous = results.filter(r => r.status === 'ambiguous');
    const notFound  = results.filter(r => r.status === 'not_found' || r.status === 'error');

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('📊  Kết quả');
    console.log(`    ✅ Khớp đúng    : ${ok}`);
    console.log(`    🔄 ID cần sửa  : ${changed.length}`);
    console.log(`    ⚠️  Cần xét thủ công: ${ambiguous.length}`);
    console.log(`    ❌ Không tìm thấy: ${notFound.length}`);
    console.log('═══════════════════════════════════════════════════════');

    if (changed.length > 0) {
        console.log('\n🔄  IDs cần cập nhật trong importPlayers.ts:');
        console.log('─────────────────────────────────────────────────');
        for (const r of changed) {
            console.log(
                `    [${r.group}] ${r.name.padEnd(26)} ` +
                `${String(r.currentId).padStart(5)} → ${r.resolvedId} "${r.resolvedName}"`
            );
        }
    }

    if (ambiguous.length > 0) {
        console.log('\n⚠️   Cần xét thủ công (nhiều national team trùng tên):');
        console.log('─────────────────────────────────────────────────');
        for (const r of ambiguous) {
            console.log(`    [${r.group}] ${r.name}`);
            for (const c of r.candidates) {
                const isCurrent = c.id === r.currentId ? ' ← current' : '';
                console.log(`           id=${c.id}  "${c.name}"${isCurrent}`);
            }
        }
    }

    if (notFound.length > 0) {
        console.log('\n❌  Không tìm thấy (kiểm tra tên/alias):');
        for (const r of notFound) {
            console.log(`    [${r.group}] ${r.name}${r.error ? ` — ${r.error}` : ''}`);
        }
    }

    // ── Xuất JSON nếu có --out ─────────────────────────────────────────────
    if (outFile) {
        const { writeFileSync } = await import('fs');
        const output = results.map(r => ({
            name:    r.name,
            group:   r.group,
            id:      r.resolvedId ?? r.currentId,
            idOk:    r.status === 'ok' || r.status === 'changed',
            warning: r.status !== 'ok' && r.status !== 'changed'
                ? `${r.status}${r.status === 'ambiguous' ? `: ${r.candidates.map(c => c.id).join(',')}` : ''}`
                : undefined,
        }));
        writeFileSync(outFile, JSON.stringify(output, null, 2), 'utf8');
        console.log(`\n📄  Đã ghi ${outFile}`);
    }

    // ── Snippet để paste vào importPlayers.ts ─────────────────────────────
    const resolved = results.filter(r => r.resolvedId != null && r.status !== 'ambiguous');
    if (resolved.length > 0 && changed.length > 0) {
        console.log('\n📋  Snippet WC_2026_TEAMS (chỉ các đội đã resolve thành công):');
        console.log('─────────────────────────────────────────────────');

        // Group by group
        const byGroup: Record<string, ResolveResult[]> = {};
        for (const r of resolved) {
            (byGroup[r.group] ??= []).push(r);
        }

        for (const [group, entries] of Object.entries(byGroup).sort()) {
            console.log(`    // ── Group ${group}`);
            for (const r of entries) {
                const changed = r.resolvedId !== r.currentId;
                const comment = changed ? ` // was ${r.currentId}` : '';
                console.log(`    { id: ${String(r.resolvedId).padEnd(5)}, name: '${r.name}', group: '${r.group}' },${comment}`);
            }
        }
    }
}

main().catch(err => {
    console.error('\n💥 Fatal:', err.message ?? err);
    process.exit(1);
});