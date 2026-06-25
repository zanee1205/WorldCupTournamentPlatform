import type { WorldCupMatch, WorldCupStanding } from './types';

export function buildStandings(matches: WorldCupMatch[]): WorldCupStanding[] {
    const standingsMap = new Map<string, WorldCupStanding>();

    const ensureTeam = (group: string, team: string) => {
        const key = `${group}::${team}`;
        if (!standingsMap.has(key)) {
            standingsMap.set(key, {
                group,
                team,
                played: 0,
                won: 0,
                drawn: 0,
                lost: 0,
                goalsFor: 0,
                goalsAgainst: 0,
                goalDifference: 0,
                points: 0,
            });
        }
        return standingsMap.get(key)!;
    };

    for (const match of matches) {
        if (!match.score) continue;

        const home = ensureTeam(match.group || 'Unknown', match.homeTeam);
        const away = ensureTeam(match.group || 'Unknown', match.awayTeam);

        home.played += 1;
        away.played += 1;
        home.goalsFor += match.score.home ?? 0;
        home.goalsAgainst += match.score.away ?? 0;
        away.goalsFor += match.score.away ?? 0;
        away.goalsAgainst += match.score.home ?? 0;

        const homeGoals = match.score.home ?? 0;
        const awayGoals = match.score.away ?? 0;

        if (homeGoals > awayGoals) {
            home.won += 1;
            away.lost += 1;
            home.points += 3;
        } else if (homeGoals < awayGoals) {
            home.lost += 1;
            away.won += 1;
            away.points += 3;
        } else {
            home.drawn += 1;
            away.drawn += 1;
            home.points += 1;
            away.points += 1;
        }
    }

    return Array.from(standingsMap.values())
        .map((entry) => ({
            ...entry,
            goalDifference: entry.goalsFor - entry.goalsAgainst,
        }))
        .sort((left, right) => {
            if (right.points !== left.points) return right.points - left.points;
            if (right.goalDifference !== left.goalDifference) return right.goalDifference - left.goalDifference;
            return right.goalsFor - left.goalsFor;
        });
}
