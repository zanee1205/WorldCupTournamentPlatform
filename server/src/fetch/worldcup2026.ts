import { setTimeout as delay } from 'node:timers/promises';

import type { MatchStage } from '../types/matchstage.js';
import type { MatchResult } from '../types/resultInput.js';
import type { TournamentMatch } from '../types/tournamentMatch.js';

import { toTeamNameEN } from '../mappings/teamNameVIToEN.js';

const WORLD_CUP_URL =
  'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json';


type OpenFootballGoal = {
  name?: string;
  minute?: string | number;
};

type OpenFootballMatch = {
  team1?: string;
  team2?: string;
  date?: string;
  time?: string;
  round?: string;
  group?: string;
  ground?: string;
  stage?: string;
  score?: {
    ft?: [number | string, number | string];
    ht?: [number | string, number | string];
  };
  goals1?: OpenFootballGoal[];
  goals2?: OpenFootballGoal[];
};

type OpenFootballJson = {
  stages?: Record<string, OpenFootballMatch[]>;
  matches?: OpenFootballMatch[];
  [key: string]: unknown;
};

function safeString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function toInt(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value)) return value;
  if (typeof value === 'string') {
    const n = Number(value);
    if (Number.isFinite(n)) return Math.trunc(n);
  }
  return null;
}

function toDateKey(date?: string): string {
  if (!date) return '';
  return date.trim();
}


function toVietnamTimeLabel(time?: string): string | null {
  if (!time) return null;

  const trimmed = time.trim();
  const m = trimmed.match(
    /^(?<hh>\d{1,2}):(?<mm>\d{2})\s*UTC(?<offset>[+-]\d{1,2})$/i,
  );
  if (!m?.groups) return trimmed;

  const hour = Number(m.groups.hh);
  const minute = Number(m.groups.mm);
  const offsetHours = Number(m.groups.offset);
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || !Number.isFinite(offsetHours)) {
    return trimmed;
  }

  const shiftMinutes = (7 - offsetHours) * 60;
  const totalMinutes = hour * 60 + minute + shiftMinutes;
  const normalized = ((totalMinutes % (24 * 60)) + (24 * 60)) % (24 * 60);
  const outH = Math.floor(normalized / 60);
  const outM = normalized % 60;
  return `${String(outH).padStart(2, '0')}:${String(outM).padStart(2, '0')}`;
}

function toVietnamDateKeyAndTime(date?: string, time?: string): { dateKey: string; timeLabel: string | null } {
  const defaultKey = toDateKey(date);
  if (!time) return { dateKey: defaultKey, timeLabel: null };

  const trimmed = time.trim();
  const m = trimmed.match(/^(?<hh>\d{1,2}):(?<mm>\d{2})\s*UTC(?<offset>[+-]\d{1,2})$/i);
  if (!m?.groups) {
    return { dateKey: defaultKey, timeLabel: trimmed };
  }

  const hour = Number(m.groups.hh);
  const minute = Number(m.groups.mm);
  const offsetHours = Number(m.groups.offset);

  const parts = defaultKey.split('-').map((p) => Number(p));
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) {
    return { dateKey: defaultKey, timeLabel: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}` };
  }

  const [year, month, day] = parts;

  // Compute UTC epoch for the fixture's local time: UTC = local - offset
  const utcEpoch = Date.UTC(year, month - 1, day, hour - offsetHours, minute);
  // Shift to Vietnam time (UTC+7)
  const vietnamEpoch = utcEpoch + 7 * 60 * 60 * 1000;

  const d = new Date(vietnamEpoch);
  const vy = d.getUTCFullYear();
  const vm = d.getUTCMonth() + 1;
  const vd = d.getUTCDate();
  const vh = d.getUTCHours();
  const vmin = d.getUTCMinutes();

  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    dateKey: `${vy}-${pad(vm)}-${pad(vd)}`,
    timeLabel: `${pad(vh)}:${pad(vmin)}`,
  };
}



function mapOpenfootballStageToInternal(stageRaw: string | undefined): MatchStage {
  const s = (stageRaw ?? '').toLowerCase();

  if (s.includes('group')) return 'group';
  if (s.includes('round of 32') || s.includes('roundof32') || s.includes('r16') || s.includes('32')) return 'round_of_32';
  if (s.includes('round of 16') || s.includes('roundof16') || s.includes('r8') || s.includes('16')) return 'round_of_16';
  if (s.includes('quarter')) return 'quarterfinal';
  if (s.includes('semi')) return 'semifinal';
  if (s.includes('third')) return 'third_place';
  if (s.includes('final')) return 'final';

  return 'group';
}

function normalizeStageLabel(stage: MatchStage): string {
  const map: Record<MatchStage, string> = {
    group: 'Vòng bảng',
    round_of_32: 'Vòng 32 đội',
    round_of_16: 'Vòng 1/8',
    quarterfinal: 'Vòng tứ kết',
    semifinal: 'Vòng bán kết',
    third_place: 'Tranh hạng Ba',
    final: 'Chung kết',
  };

  return map[stage];
}

function makeDeterministicId(key: string): number {
  // stable hash -> positive int
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) + 1;
}

function extractFinal(match: OpenFootballMatch): { actualHomeScore: number | null; actualAwayScore: number | null } {
  const ft = match.score?.ft;
  if (!ft || ft.length < 2) return { actualHomeScore: null, actualAwayScore: null };
  return {
    actualHomeScore: toInt(ft[0]),
    actualAwayScore: toInt(ft[1]),
  };
}

function extractHalftime(match: OpenFootballMatch): { halftimeHomeScore: number | null; halftimeAwayScore: number | null } {
  const ht = match.score?.ht;
  if (!ht || ht.length < 2) return { halftimeHomeScore: null, halftimeAwayScore: null };
  return {
    halftimeHomeScore: toInt(ht[0]),
    halftimeAwayScore: toInt(ht[1]),
  };
}

function extractGoals(match: OpenFootballMatch): MatchResult['goals'] {
  const homeTeam = toTeamNameEN(safeString(match.team1));
  const awayTeam = toTeamNameEN(safeString(match.team2));

  const homeGoals = (match.goals1 ?? []).map((g) => ({
    team: homeTeam,
    player: safeString(g.name),
    minute: g.minute ?? '',
  }));

  const awayGoals = (match.goals2 ?? []).map((g) => ({
    team: awayTeam,
    player: safeString(g.name),
    minute: g.minute ?? '',
  }));

  return [...homeGoals, ...awayGoals].filter((x) => Boolean(x.player));
}

export type Worldcup2026FetchOutput = {
  matches: TournamentMatch[];
};

export async function fetchWorldcup2026Matches(): Promise<Worldcup2026FetchOutput> {
  const json = await (async () => {
    const maxAttempts = 3;
    let lastErr: unknown = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const res = await fetch(WORLD_CUP_URL, {
          headers: {
            'Cache-Control': 'no-cache',
          },
        });

        if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
        return (await res.json()) as OpenFootballJson;
      } catch (err) {
        lastErr = err;
        await delay(500 * attempt);
      }
    }

    throw lastErr;
  })();

  const stageEntries: Array<{ rawKey: string; matches: OpenFootballMatch[] }> = [];

  if (json.stages && typeof json.stages === 'object') {
    for (const [stageKey, stageMatches] of Object.entries(json.stages)) {
      stageEntries.push({
        rawKey: String(stageKey),
        matches: Array.isArray(stageMatches) ? (stageMatches as OpenFootballMatch[]) : [],
      });
    }
  }

  if (stageEntries.length === 0 && Array.isArray(json.matches)) {
    stageEntries.push({ rawKey: '', matches: json.matches as OpenFootballMatch[] });
  }

  function determineStage(stageRaw: string | undefined, match?: OpenFootballMatch): MatchStage {
    const parts: string[] = [];
    if (stageRaw) parts.push(stageRaw);
    if (match) {
      if (match.stage) parts.push(String(match.stage));
      if (match.round) parts.push(String(match.round));
      if (match.group) parts.push(String(match.group));
    }

    const s = parts.join(' ').toLowerCase();

    if (s.includes('third')) return 'third_place';
    if (s.includes('final') && !s.includes('third')) return 'final';
    if (s.includes('semi') || s.includes('semifinal')) return 'semifinal';
    if (s.includes('quarter') || s.includes('1/4')) return 'quarterfinal';
    if (s.includes('round of 32') || s.includes('roundof32') || s.includes('r32') || /\b32\b/.test(s)) return 'round_of_32';
    if (s.includes('round of 16') || s.includes('roundof16') || s.includes('r16') || s.includes('1/8') || /\b16\b/.test(s)) return 'round_of_16';

    // Many feeds use 'Matchday 1/2/3' to represent group matchdays; treat as group.
    if (s.includes('matchday') || s.includes('day') && /matchday|day\s*\d+/i.test(s)) return 'group';
    if (s.includes('group') || s.includes('groupstage') || s.includes('group stage')) return 'group';

    // Fallback to group to keep existing UX consistent
    return 'group';
  }

  const matches: TournamentMatch[] = [];

  for (const stageEntry of stageEntries) {
    for (const m of stageEntry.matches) {
      const stage = determineStage(stageEntry.rawKey, m);
      const homeLabel = toTeamNameEN(safeString(m.team1));
      const awayLabel = toTeamNameEN(safeString(m.team2));

      const { dateKey, timeLabel } = toVietnamDateKeyAndTime(m.date, m.time);

      if (!homeLabel || !awayLabel || !dateKey) continue;

      const groupLabel = safeString(m.group) || null;
      const venue = safeString(m.ground) || null;

      const id = makeDeterministicId([groupLabel ?? '', dateKey, homeLabel, awayLabel].join('|').toLowerCase());

      const { actualHomeScore, actualAwayScore } = extractFinal(m);
      const halftime = extractHalftime(m);
      const goals = extractGoals(m);

      const result: MatchResult | null =
        actualHomeScore !== null && actualAwayScore !== null
          ? {
            actualHomeScore,
            actualAwayScore,
            halftimeHomeScore: halftime.halftimeHomeScore ?? undefined,
            halftimeAwayScore: halftime.halftimeAwayScore ?? undefined,
            goals,
            updatedAt: new Date().toISOString(),
          }
          : null;

      matches.push({
        id,
        stage,
        stageLabel: normalizeStageLabel(stage),
        dateKey,
        timeLabel: timeLabel ?? null,

        venue,
        groupLabel: stage === 'group' ? groupLabel : null,
        homeLabel,
        awayLabel,
        title: `${homeLabel} vs ${awayLabel}`,
        note: venue ? `Venue: ${venue}` : null,
        prediction: null,
        result,
        score: null,
      });
    }
  }

  matches.sort((a, b) => a.id - b.id);
  return { matches };
}

