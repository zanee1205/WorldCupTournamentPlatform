import fs from 'node:fs';
import path from 'node:path';

// Manual mapping team names (Vietnamese/localized) -> English names.
// Keep this file under source control for manual corrections. An auto-generated
// mapping file `teamNames.auto.json` will be read and merged at runtime so we
// can automatically cover all upstream feed names.

const MANUAL: Record<string, string> = {

    // Europe (sample keys - extend as needed)
    'Pháp': 'France',
    'Anh': 'England',
    'Đức': 'Germany',
    'Tây Ban Nha': 'Spain',
    'Ý': 'Italy',
    'Bồ Đào Nha': 'Portugal',
    'Hà Lan': 'Netherlands',

    // Americas (sample keys - extend as needed)
    'Brazil': 'Brazil',
    'Argentina': 'Argentina',
    'Uruguay': 'Uruguay',
    'Colombia': 'Colombia',
    'Mexico': 'Mexico',
};

// Load optional auto-generated mappings created from the upstream feed.
let AUTO: Record<string, string> = {};
try {
    const autoPath = path.resolve(process.cwd(), 'server', 'src', 'mappings', 'teamNames.auto.json');
    if (fs.existsSync(autoPath)) {
        const raw = fs.readFileSync(autoPath, 'utf8');
        AUTO = JSON.parse(raw) as Record<string, string>;
    }
} catch (e) {
    // ignore parse errors and fallback to manual map only
}

// Merge maps: AUTO first, then MANUAL so manual entries override auto-generated ones.
export const TEAM_NAME_VI_TO_EN: Record<string, string> = {
    ...AUTO,
    ...MANUAL,
};

export function toTeamNameEN(input: string | null | undefined): string {
    if (!input) return '';
    const raw = input.trim();
    return TEAM_NAME_VI_TO_EN[raw] ?? raw;
}


