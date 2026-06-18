import fs from 'node:fs';
import path from 'node:path';

import { toDateKey } from '../../shared/date.js';
import type { MatchStage } from '../../server/src/types/matchstage.js';
import type { TournamentMatch } from '../../server/src/types/tournamentMatch.js';
import { toTeamNameEN } from './mappings/teamNameVIToEN.js';

type ParsedMatchInput = Omit<TournamentMatch, 'prediction' | 'result' | 'score'>;

const STAGE_LABELS: Record<MatchStage, string> = {
  group: 'Vòng bảng',
  round_of_32: 'Vòng 32 đội',
  round_of_16: 'Vòng 1/8',
  quarterfinal: 'Vòng tứ kết',
  semifinal: 'Vòng bán kết',
  third_place: 'Tranh hạng ba',
  final: 'Chung kết',
};

const ROUND_OF_16_PLACEHOLDERS = [
  { dateKey: '2026-07-05', venue: 'Houston' },
  { dateKey: '2026-07-05', venue: 'Philadelphia' },
  { dateKey: '2026-07-06', venue: 'New York New Jersey' },
  { dateKey: '2026-07-06', venue: 'Mexico City' },
  { dateKey: '2026-07-07', venue: 'Dallas' },
  { dateKey: '2026-07-07', venue: 'Seattle' },
  { dateKey: '2026-07-08', venue: 'Atlanta' },
  { dateKey: '2026-07-08', venue: 'BC Place Vancouver' },
];

const ROUND_OF_16_LABELS = [
  ['Thắng trận 73', 'Thắng trận 74'],
  ['Thắng trận 75', 'Thắng trận 76'],
  ['Thắng trận 77', 'Thắng trận 78'],
  ['Thắng trận 79', 'Thắng trận 80'],
  ['Thắng trận 81', 'Thắng trận 82'],
  ['Thắng trận 83', 'Thắng trận 84'],
  ['Thắng trận 85', 'Thắng trận 86'],
  ['Thắng trận 87', 'Thắng trận 88'],
] as const;

function buildMatch(
  id: number,
  stage: MatchStage,
  data: {
    dateKey: string;
    timeLabel: string | null;
    venue: string | null;
    groupLabel: string | null;
    homeLabel: string | null;
    awayLabel: string | null;
    title: string;
    note: string | null;
  },
): ParsedMatchInput {
  return {
    id,
    stage,
    stageLabel: STAGE_LABELS[stage],
    dateKey: data.dateKey,
    timeLabel: data.timeLabel,
    venue: data.venue,
    groupLabel: data.groupLabel,
    homeLabel: data.homeLabel,
    awayLabel: data.awayLabel,
    title: data.title,
    note: data.note,
  };
}

function parseGroupMatch(line: string, dateKey: string, id: number): ParsedMatchInput | null {
  const match = line.match(
    /^(?<time>\d{2}:\d{2})(?:\s+\((?<note>[^)]+)\))?:\s+(?<home>.+?) vs (?<away>.+?) \((?<group>Bảng\s+[A-L])\)\s+[–-]\s+SVĐ\s+(?<venue>.+)$/u,
  );

  if (!match?.groups) {
    return null;
  }

  const { time, home, away, group, venue } = match.groups;
  const homeEn = toTeamNameEN(home);
  const awayEn = toTeamNameEN(away);
  return buildMatch(id, 'group', {
    dateKey,
    timeLabel: time,
    venue,
    groupLabel: group,
    homeLabel: homeEn,
    awayLabel: awayEn,
    title: `${homeEn} vs ${awayEn}`,
    note: `${group} • SVĐ ${venue}`,
  });
}

function parseKnockoutMatch(line: string, stage: MatchStage, id: number): ParsedMatchInput | null {
  const lineMatch = line.match(
    /^(?<prefix>\d{1,2}\/\d{1,2}(?:\s*-\s*\d{2}:\d{2})?(?:\s*\([^)]*\))?):\s+(?<rest>.+)$/u,
  );

  if (!lineMatch?.groups) {
    return null;
  }

  const { prefix, rest } = lineMatch.groups;
  const prefixMatch = prefix.match(
    /^(?<date>\d{1,2}\/\d{1,2})(?:\s*-\s*(?<time>\d{2}:\d{2}))?(?:\s*\((?<note>[^)]+)\))?$/u,
  );

  if (!prefixMatch?.groups) {
    return null;
  }

  const { date, time, note } = prefixMatch.groups;
  const refDateKey = toDateKey(date);

  if (stage === 'third_place' || stage === 'final') {
    const venueMatch = rest.match(/^Tại SVĐ (?<venue>.+)\.$/u);
    if (!venueMatch?.groups) {
      return null;
    }

    const venue = venueMatch.groups.venue;
    const title =
      stage === 'third_place' ? 'Thua bán kết 1 vs Thua bán kết 2' : 'Thắng bán kết 1 vs Thắng bán kết 2';

    return buildMatch(id, stage, {
      dateKey: refDateKey,
      timeLabel: time ?? null,
      venue,
      groupLabel: null,
      homeLabel: stage === 'third_place' ? 'Thua bán kết 1' : 'Thắng bán kết 1',
      awayLabel: stage === 'third_place' ? 'Thua bán kết 2' : 'Thắng bán kết 2',
      title,
      note: note ? `${note} • SVĐ ${venue}` : `SVĐ ${venue}`,
    });
  }

  const restMatch = rest.match(
    /^(?<home>.+?) vs (?<away>.+?) \((?:SVĐ\s+)?(?<venue>.+)\)$/u,
  );

  if (!restMatch?.groups) {
    return null;
  }

  const { home, away, venue } = restMatch.groups;
  const homeEn = toTeamNameEN(home);
  const awayEn = toTeamNameEN(away);
  return buildMatch(id, stage, {
    dateKey: refDateKey,
    timeLabel: time ?? null,
    venue,
    groupLabel: null,
    homeLabel: homeEn,
    awayLabel: awayEn,
    title: `${homeEn} vs ${awayEn}`,
    note: `SVĐ ${venue}`,
  });
}

function createRoundOf16Matches(startId: number): ParsedMatchInput[] {
  return ROUND_OF_16_PLACEHOLDERS.map((fixture, index) => {
    const [homeLabel, awayLabel] = ROUND_OF_16_LABELS[index];
    return buildMatch(startId + index, 'round_of_16', {
      dateKey: fixture.dateKey,
      timeLabel: null,
      venue: fixture.venue,
      groupLabel: null,
      homeLabel,
      awayLabel,
      title: `${homeLabel} vs ${awayLabel}`,
      note: `Chưa rõ giờ • SVĐ ${fixture.venue}`,
    });
  });
}

export function loadSeedMatches(): TournamentMatch[] {
  const rawPath = path.resolve(process.cwd(), 'shared', 'raw-schedule.txt');
  const rawText = fs.readFileSync(rawPath, 'utf8');
  const lines = rawText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

  const matches: ParsedMatchInput[] = [];
  let section: MatchStage | 'group' = 'group';
  let currentGroupDateKey = '';
  let roundOf16Inserted = false;

  for (const line of lines) {
    if (line.startsWith('Vòng 32 đội')) {
      section = 'round_of_32';
      continue;
    }

    if (line === 'Vòng 1/8:' && !roundOf16Inserted) {
      section = 'round_of_16';
      const startId = matches.length + 1;
      matches.push(...createRoundOf16Matches(startId));
      roundOf16Inserted = true;
      continue;
    }

    if (line.startsWith('Vòng tứ kết')) {
      section = 'quarterfinal';
      continue;
    }

    if (line.startsWith('Vòng bán kết')) {
      section = 'semifinal';
      continue;
    }

    if (line.startsWith('Tranh hạng Ba')) {
      section = 'third_place';
      continue;
    }

    if (line.startsWith('Chung kết World Cup 2026')) {
      section = 'final';
      continue;
    }

    const headerMatch = line.match(/^Thứ .*?,\s*(?<date>\d{1,2}\/\d{1,2}\/\d{4})$/u);
    if (section === 'group' && headerMatch?.groups) {
      currentGroupDateKey = toDateKey(headerMatch.groups.date);
      continue;
    }

    if (section === 'group') {
      const match = parseGroupMatch(line, currentGroupDateKey, matches.length + 1);
      if (match) {
        matches.push(match);
      }
      continue;
    }

    if (section === 'round_of_32' || section === 'quarterfinal' || section === 'semifinal') {
      const match = parseKnockoutMatch(line, section, matches.length + 1);
      if (match) {
        matches.push(match);
      }
      continue;
    }

    if (section === 'third_place' || section === 'final') {
      const match = parseKnockoutMatch(line, section, matches.length + 1);
      if (match) {
        matches.push(match);
      }
    }
  }

  return matches.map((match) => ({
    ...match,
    prediction: null,
    result: null,
    score: null,
  }));
}
