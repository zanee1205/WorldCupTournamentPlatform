import { makeId, safeString, toDateKey, toInt, toVietnamTimeLabel } from './DateFormat';
import type { OpenFootballJson } from '../types/openFootballJson';
import type { OpenFootballMatch } from '../types/worldcupMatchCore';
import type { WorldCupData } from '../types/worldCupData';
import type { WorldCupGoal } from '../types/worldCupGoal';
import { buildStandings } from './standings';
import { buildVenueStats } from './venues';

function normalizeBracketReference(value: string) {
    return value.trim().toUpperCase();
}

function formatBracketPlaceholderLabel(value: string) {
    const normalized = normalizeBracketReference(value);
    const refMatch = normalized.match(/^([WL])(\d+)$/);
    if (!refMatch) {
        return safeString(value);
    }

    const [, kind, num] = refMatch;
    return kind === 'W' ? `W${num}` : `L${num}`;
}

function resolveBracketTeamLabel(value: string) {
    return formatBracketPlaceholderLabel(value);
}

export function normalizeWorldcupData(json: OpenFootballJson, sourceUrl: string): WorldCupData {
    const stageEntries: Array<{ rawKey: string; matches: OpenFootballMatch[] }> = [];

    const stages = (json as OpenFootballJson & { stages?: Record<string, OpenFootballMatch[]> }).stages;
    if (stages && typeof stages === 'object') {
        for (const [stageKey, matches] of Object.entries(stages)) {
            stageEntries.push({
                rawKey: String(stageKey),
                matches: Array.isArray(matches) ? (matches as OpenFootballMatch[]) : [],
            });
        }
    }

    if (stageEntries.length === 0 && Array.isArray(json.matches)) {
        stageEntries.push({ rawKey: '', matches: json.matches as OpenFootballMatch[] });
    }

    const matches = [] as WorldCupData['matches'];

    for (const stageEntry of stageEntries) {
        for (const match of stageEntry.matches) {
            const stage = safeString(match.stage) || stageEntry.rawKey || 'unknown';
            const rawHomeTeam = safeString(match.team1);
            const rawAwayTeam = safeString(match.team2);
            const homeTeam = stage.toLowerCase().includes('group')
                ? rawHomeTeam
                : resolveBracketTeamLabel(rawHomeTeam);
            const awayTeam = stage.toLowerCase().includes('group')
                ? rawAwayTeam
                : resolveBracketTeamLabel(rawAwayTeam);
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
                id: makeId([stageEntry.rawKey, rawDate, rawTime, rawHomeTeam, rawAwayTeam].join('|')),
                num: match.num,
                stage,
                round: safeString(match.round),
                group: safeString(match.group),
                date: rawDate,
                time: rawTime,
                dateKey: toDateKey(rawDate),
                timeLabel: toVietnamTimeLabel(rawTime),
                homeTeam: homeTeam || rawHomeTeam,
                awayTeam: awayTeam || rawAwayTeam,
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
