import { makeId, safeString, toDateKey, toInt, toVietnamTimeLabel } from './DateFormat';
import type { OpenFootballJson } from '../types/openFootballJson';
import type { OpenFootballMatch } from '../types/worldcupMatchCore';
import type { WorldCupData } from '../types/worldCupData';
import type { WorldCupGoal } from '../types/worldCupGoal';
import { buildStandings } from './standings';
import { buildVenueStats } from './venues';

export function normalizeWorldcupData(json: OpenFootballJson, sourceUrl: string): WorldCupData {
    const stageEntries: Array<{ rawKey: string; matches: OpenFootballMatch[] }> = [];

    if (json.stages && typeof json.stages === 'object') {
        for (const [stageKey, matches] of Object.entries(json.stages)) {
            stageEntries.push({ rawKey: String(stageKey), matches: Array.isArray(matches) ? (matches as OpenFootballMatch[]) : [] });
        }
    }

    if (stageEntries.length === 0 && Array.isArray(json.matches)) {
        stageEntries.push({ rawKey: '', matches: json.matches as OpenFootballMatch[] });
    }

    const matches = [] as WorldCupData['matches'];

    for (const stageEntry of stageEntries) {
        for (const match of stageEntry.matches) {
            const homeTeam = safeString(match.team1);
            const awayTeam = safeString(match.team2);
            const rawDate = safeString(match.date);
            const rawTime = safeString(match.time);
            const venue = safeString(match.ground);
            const ft = match.score?.ft;
            const ht = match.score?.ht;
            const homeScore = ft && ft.length >= 2 ? toInt(ft[0]) : null;
            const awayScore = ft && ft.length >= 2 ? toInt(ft[1]) : null;
            const halftimeHome = ht && ht.length >= 2 ? toInt(ht[0]) : null;
            const halftimeAway = ht && ht.length >= 2 ? toInt(ht[1]) : null;
            const goals: WorldCupGoal[] = [];

            for (const goal of match.goals1 ?? []) {
                const player = safeString(goal.name);
                if (player) {
                    goals.push({ team: homeTeam, player, minute: goal.minute ?? '' });
                }
            }

            for (const goal of match.goals2 ?? []) {
                const player = safeString(goal.name);
                if (player) {
                    goals.push({ team: awayTeam, player, minute: goal.minute ?? '' });
                }
            }

            matches.push({
                id: makeId([stageEntry.rawKey, rawDate, rawTime, homeTeam, awayTeam].join('|')),
                stage: safeString(match.stage) || stageEntry.rawKey || 'unknown',
                round: safeString(match.round),
                group: safeString(match.group),
                date: rawDate,
                time: rawTime,
                dateKey: toDateKey(rawDate),
                timeLabel: toVietnamTimeLabel(rawTime),
                homeTeam,
                awayTeam,
                venue,
                status: homeScore !== null && awayScore !== null ? 'finished' : 'scheduled',
                score:
                    homeScore !== null && awayScore !== null
                        ? { home: homeScore, away: awayScore, halftimeHome, halftimeAway }
                        : null,
                goals,
            });
        }
    }

    return {
        matches: matches.sort((left, right) => {
            if (left.dateKey !== right.dateKey) return left.dateKey.localeCompare(right.dateKey);
            return left.timeLabel.localeCompare(right.timeLabel);
        }),
        standings: buildStandings(matches),
        venues: buildVenueStats(matches),
        lastUpdated: new Date().toISOString(),
        sourceUrl,
    };
}
