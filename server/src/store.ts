import mongoose from 'mongoose';

import { buildScoreBreakdown } from '../../shared/scoring.js';
import type { TournamentMatch } from '../../shared/types/tournamentMatch.js';
import type { MatchPrediction } from '../../server/src/types/predictionInput.js';
import type { MatchResult } from '../../server/src/types/resultInput.js';
import type { ScoreLedgerEntry } from '../../src/types/scoreLedgerEntry.js';
import type { DashboardSummary } from '../../src/types/dashboardSummary.js';
import type { DashboardResponse } from './types/dashboardResponse.js';
import type { PlayerListItem } from '../../src/types/playerListItem.js';
import type { GroupStandingBoard, GroupStandingTeam } from '../../shared/types/groupStanding.js';
import type { TeamLineup, LineupPlayer, ReplacementPlayer } from '../../shared/types/teamLineup.js';

import { formatDateKey } from '../../shared/date.js';
import { fetchWorldcup2026Matches } from './fetch/worldcup2026.js';


type MatchDocument = Omit<TournamentMatch, 'score'>;

type PlayerDocument = {
    playerId: string;
    apiId: number;
    name: string;
    age: number | null;
    number: number | null;
    photo: string;
    position: string;
    teamCode: string;
    teamName: string;
    teamId: number;
    group: string;
};

type TeamDocument = {
    teamId: number;
    formation?: string | null;
    formationSource?: string | null;
    group: string;
    teamCode: string;
    teamName: string;
};

const predictionSchema = new mongoose.Schema<MatchPrediction>(
    {
        predictedHomeScore: { type: Number, required: true },
        predictedAwayScore: { type: Number, required: true },
        updatedAt: { type: String, required: true },
    },
    { _id: false },
);

const resultSchema = new mongoose.Schema<MatchResult>(
    {
        actualHomeScore: { type: Number, required: true },
        actualAwayScore: { type: Number, required: true },
        // Optional halftime scores
        halftimeHomeScore: { type: Number, required: false },
        halftimeAwayScore: { type: Number, required: false },

        // Goal scorers: team, player, minute
        goals: [
            {
                team: { type: String, required: true },
                player: { type: String, required: true },
                minute: { type: mongoose.Schema.Types.Mixed, required: false },
            },
        ],

        updatedAt: { type: String, required: true },
    },
    { _id: false },
);

const matchSchema = new mongoose.Schema<MatchDocument>(
    {
        id: { type: Number, unique: true, required: true },
        stage: { type: String, required: true },
        stageLabel: { type: String, required: true },
        dateKey: { type: String, required: true },
        timeLabel: { type: String, default: null },
        venue: { type: String, default: null },
        groupLabel: { type: String, default: null },
        homeLabel: { type: String, default: null },
        awayLabel: { type: String, default: null },
        title: { type: String, required: true },
        note: { type: String, default: null },
        prediction: { type: predictionSchema, default: null },
        result: { type: resultSchema, default: null },
    },
    { versionKey: false },
);

const MatchModel =
    (mongoose.models.TournamentMatch as mongoose.Model<MatchDocument> | undefined) ||
    mongoose.model<MatchDocument>('TournamentMatch', matchSchema);

const DEF_POSITIONS = new Set(['CB', 'LB', 'RB', 'LWB', 'RWB', 'DF', 'D', 'DEFENDER', 'DEFENDERS']);
const MID_POSITIONS = new Set(['CDM', 'CM', 'CAM', 'LM', 'RM', 'MF', 'M', 'MIDFIELDER', 'MIDFIELDERS']);
const ATT_POSITIONS = new Set(['ST', 'CF', 'SS', 'LW', 'RW', 'FW', 'F', 'ATTACKER', 'FORWARD', 'FORWARDS']);

function normalizeText(value: string): string {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

function escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function positionGroup(position: string): 'GK' | 'DEF' | 'MID' | 'ATT' {
    const normalized = position.trim().toUpperCase();
    if (normalized === 'GK' || normalized === 'G' || normalized === 'GOALKEEPER') return 'GK';
    if (DEF_POSITIONS.has(normalized)) return 'DEF';
    if (MID_POSITIONS.has(normalized)) return 'MID';
    if (ATT_POSITIONS.has(normalized)) return 'ATT';
    return 'MID';
}

function sortPlayer(left: PlayerDocument, right: PlayerDocument) {
    const leftNumber = left.number ?? 999;
    const rightNumber = right.number ?? 999;
    return leftNumber - rightNumber || left.name.localeCompare(right.name, 'vi');
}

function pickPlayers(players: PlayerDocument[], count: number, selectedIds: Set<string>) {
    const picked: PlayerDocument[] = [];
    for (const player of players) {
        if (selectedIds.has(player.playerId)) continue;
        picked.push(player);
        selectedIds.add(player.playerId);
        if (picked.length === count) break;
    }
    return picked;
}

function parseFormation(formation?: string | null): number[] {
    const parts = (formation ?? '')
        .trim()
        .split('-')
        .map((part) => Number(part))
        .filter((part) => Number.isInteger(part) && part > 0);

    if (parts.length >= 2 && parts.reduce((sum, part) => sum + part, 0) === 10) {
        return parts;
    }

    return [4, 3, 3];
}

function formationLineGroup(lineIndex: number, totalLines: number): 'DEF' | 'MID' | 'ATT' {
    if (lineIndex === 0) return 'DEF';
    if (lineIndex === totalLines - 1) return 'ATT';
    return 'MID';
}

function lineCoordinates(lineIndex: number, totalLines: number, playerIndex: number, totalPlayers: number) {
    const x = lineIndex < 0
        ? 9
        : 28 + ((totalLines <= 1 ? 0 : lineIndex / (totalLines - 1)) * 50);
    const presets: Record<number, number[]> = {
        1: [50],
        2: [35, 65],
        3: [24, 50, 76],
        4: [17, 39, 61, 83],
        5: [12, 31, 50, 69, 88],
    };
    const ys = presets[Math.min(totalPlayers, 5)] ?? presets[4];
    return {
        x,
        y: ys[Math.min(playerIndex, ys.length - 1)],
    };
}

function localDateKey(date = new Date()): string {
    return [
        date.getFullYear().toString(),
        (date.getMonth() + 1).toString().padStart(2, '0'),
        date.getDate().toString().padStart(2, '0'),
    ].join('-');
}

function decorateMatch(match: MatchDocument): TournamentMatch {
    const { _id, __v, ...cleanMatch } = match as MatchDocument & { _id?: unknown; __v?: unknown };
    let score = null;
    if (cleanMatch.prediction && cleanMatch.result) {
        try {
            // buildScoreBreakdown may throw if stage is unexpected; guard to avoid bubbling to HTTP 500
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            score = buildScoreBreakdown(cleanMatch.stage as any, cleanMatch.prediction as any, cleanMatch.result as any);
        } catch (err) {
            // eslint-disable-next-line no-console
            console.warn(`[repository] failed to build score for match ${cleanMatch.id}:`, err);
            score = null;
        }
    }

    return {
        ...cleanMatch,
        score,
    };
}

function buildSummary(matches: TournamentMatch[]): DashboardSummary {
    const predictedMatches = matches.filter((match) => Boolean(match.prediction)).length;
    const resultMatches = matches.filter((match) => Boolean(match.result)).length;
    const completedMatches = matches.filter((match) => Boolean(match.score)).length;
    const summaryPoints = matches.reduce(
        (accumulator, match) => {
            if (!match.score) {
                return accumulator;
            }

            accumulator.totalPoints += match.score.totalPoints;
            accumulator.stagePoints += match.score.stagePoints;
            accumulator.exactPoints += match.score.exactPoints;
            return accumulator;
        },
        { totalPoints: 0, stagePoints: 0, exactPoints: 0 },
    );

    return {
        totalMatches: matches.length,
        predictedMatches,
        resultMatches,
        completedMatches,
        locked: predictedMatches === matches.length,
        totalPoints: summaryPoints.totalPoints,
        stagePoints: summaryPoints.stagePoints,
        exactPoints: summaryPoints.exactPoints,
    };
}

function buildLedger(matches: TournamentMatch[]): ScoreLedgerEntry[] {
    return matches
        .filter((match) => match.score)
        .map((match) => ({
            matchId: match.id,
            title: match.title,
            stageLabel: match.stageLabel,
            dateKey: match.dateKey,
            predictionText: `${match.prediction?.predictedHomeScore ?? '-'} - ${match.prediction?.predictedAwayScore ?? '-'}`,
            resultText: `${match.result?.actualHomeScore ?? '-'} - ${match.result?.actualAwayScore ?? '-'}`,
            trendText:
                match.score?.predictedTrend === match.score?.actualTrend
                    ? 'Đúng xu hướng'
                    : 'Sai xu hướng',
            stagePoints: match.score?.stagePoints ?? 0,
            exactPoints: match.score?.exactPoints ?? 0,
            totalPoints: match.score?.totalPoints ?? 0,
        }))
        .sort((left, right) => left.dateKey.localeCompare(right.dateKey) || left.matchId - right.matchId);
}

function buildCalendar(matches: TournamentMatch[]): Record<string, TournamentMatch[]> {
    return matches.reduce<Record<string, TournamentMatch[]>>((calendar, match) => {
        if (!calendar[match.dateKey]) {
            calendar[match.dateKey] = [];
        }

        calendar[match.dateKey].push(match);
        return calendar;
    }, {});
}

function createStandingTeam(teamName: string): GroupStandingTeam {
    return {
        rank: 0,
        teamName,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        points: 0,
    };
}

function applyGroupResult(team: GroupStandingTeam, goalsFor: number, goalsAgainst: number) {
    team.played += 1;
    team.goalsFor += goalsFor;
    team.goalsAgainst += goalsAgainst;
    team.goalDifference = team.goalsFor - team.goalsAgainst;

    if (goalsFor > goalsAgainst) {
        team.wins += 1;
        team.points += 3;
        return;
    }

    if (goalsFor === goalsAgainst) {
        team.draws += 1;
        team.points += 1;
        return;
    }

    team.losses += 1;
}

function buildStandings(matches: TournamentMatch[]): GroupStandingBoard[] {
    const boards = new Map<string, Map<string, GroupStandingTeam>>();

    for (const match of matches) {
        if (match.stage !== 'group' || !match.groupLabel || !match.homeLabel || !match.awayLabel) {
            continue;
        }

        if (!boards.has(match.groupLabel)) {
            boards.set(match.groupLabel, new Map());
        }

        const group = boards.get(match.groupLabel) as Map<string, GroupStandingTeam>;
        if (!group.has(match.homeLabel)) {
            group.set(match.homeLabel, createStandingTeam(match.homeLabel));
        }

        if (!group.has(match.awayLabel)) {
            group.set(match.awayLabel, createStandingTeam(match.awayLabel));
        }

        if (match.result) {
            applyGroupResult(group.get(match.homeLabel) as GroupStandingTeam, match.result.actualHomeScore, match.result.actualAwayScore);
            applyGroupResult(group.get(match.awayLabel) as GroupStandingTeam, match.result.actualAwayScore, match.result.actualHomeScore);
        }
    }

    return Array.from(boards.entries())
        .sort(([left], [right]) => left.localeCompare(right, 'vi'))
        .map(([groupLabel, teams]) => ({
            groupLabel,
            teams: Array.from(teams.values())
                .sort(
                    (left, right) =>
                        right.points - left.points ||
                        right.goalDifference - left.goalDifference ||
                        right.goalsFor - left.goalsFor ||
                        left.teamName.localeCompare(right.teamName, 'vi'),
                )
                .map((team, index) => ({
                    ...team,
                    rank: index + 1,
                })),
        }));
}

export class TournamentRepository {
    private matches: MatchDocument[] = [];
    private readonly useMongo: boolean;

    constructor(useMongo: boolean) {
        this.useMongo = useMongo;
    }

    async init() {
        // Seed / upsert fixtures once, then keep results synced every 30 minutes.
        await this.refreshFromFetch();

        this.scheduleRefresh();
    }

    private scheduleRefresh() {
        // Allow overriding the fetch interval via env var `FETCH_INTERVAL_MINUTES` (defaults to 30)
        const minutesEnv = process.env.FETCH_INTERVAL_MINUTES ?? '30';
        const minutes = Number(minutesEnv);
        const safeMinutes = Number.isFinite(minutes) && minutes > 0 ? Math.trunc(minutes) : 30;
        const intervalMs = safeMinutes * 60 * 1000;

        void this.refreshFromFetch();
        setInterval(() => {

            void this.refreshFromFetch();
        }, intervalMs);
    }

    private async refreshFromFetch() {
        try {
            const fetched = await fetchWorldcup2026Matches();
            const seed = fetched.matches.map(({ score, ...match }) => match as MatchDocument);

            console.log(`[repository] fetched ${seed.length} matches from upstream feed`);

            // Memory mode
            if (!this.useMongo) {
                const byId = new Map<number, MatchDocument>(this.matches.map((m) => [m.id, m]));
                for (const incoming of seed) {
                    const existing = byId.get(incoming.id);
                    if (!existing) {
                        byId.set(incoming.id, incoming);
                        continue;
                    }

                    const merged: MatchDocument = {
                        ...existing,
                        stage: incoming.stage,
                        stageLabel: incoming.stageLabel,
                        dateKey: incoming.dateKey,
                        timeLabel: incoming.timeLabel,
                        venue: incoming.venue,
                        groupLabel: incoming.groupLabel,
                        homeLabel: incoming.homeLabel,
                        awayLabel: incoming.awayLabel,
                        title: incoming.title,
                        note: incoming.note,
                        result: incoming.result,
                        prediction: existing.prediction,
                    };

                    byId.set(incoming.id, merged);
                }

                this.matches = Array.from(byId.values()).sort((a, b) => a.id - b.id);
                return;
            }


            // Allow safety mode to prevent accidental insertion of new matches
            // during periodic fetches. Set env `ALLOW_NEW_MATCHES=false` to
            // only update existing documents and skip inserts.
            const allowNewMatches = (process.env.ALLOW_NEW_MATCHES ?? 'true').toLowerCase() !== 'false';

            if (!allowNewMatches) {
                // Find which incoming ids already exist so we only update those.
                const incomingIds = seed.map((s) => s.id);
                const existing = await MatchModel.find({ id: { $in: incomingIds } }, { id: 1 }).lean();
                const existingIds = new Set(existing.map((d) => d.id));

                const bulk: any[] = [];
                let skipped = 0;
                for (const match of seed) {
                    if (!existingIds.has(match.id)) {
                        skipped += 1;
                        continue;
                    }

                    bulk.push({
                        updateOne: {
                            filter: { id: match.id },
                            update: {
                                $set: {
                                    stage: match.stage,
                                    stageLabel: match.stageLabel,
                                    dateKey: match.dateKey,
                                    timeLabel: match.timeLabel,
                                    venue: match.venue,
                                    groupLabel: match.groupLabel,
                                    homeLabel: match.homeLabel,
                                    awayLabel: match.awayLabel,
                                    title: match.title,
                                    note: match.note,
                                    result: match.result,
                                },
                            },
                            upsert: false,
                        },
                    });
                }

                if (bulk.length > 0) {
                    const res = await MatchModel.bulkWrite(bulk);
                    console.log('[repository] bulkWrite result (safe mode):', {
                        matchedCount: (res as any).matchedCount ?? (res as any).nMatched ?? 0,
                        modifiedCount: (res as any).modifiedCount ?? (res as any).nModified ?? 0,
                    });
                } else {
                    console.log('[repository] safe mode: no existing matches to update; skipped', skipped);
                }
            } else {
                const bulk = seed.map((match) => ({
                    updateOne: {
                        filter: { id: match.id },
                        update: {
                            // Always set fixture metadata from fetch.
                            $set: {
                                stage: match.stage,
                                stageLabel: match.stageLabel,
                                dateKey: match.dateKey,
                                timeLabel: match.timeLabel,
                                venue: match.venue,
                                groupLabel: match.groupLabel,
                                homeLabel: match.homeLabel,
                                awayLabel: match.awayLabel,
                                title: match.title,
                                note: match.note,
                                result: match.result,
                            },
                            $setOnInsert: {
                                prediction: null,
                                id: match.id,
                            },
                        },
                        upsert: true,
                    },
                }));

                const res = await MatchModel.bulkWrite(bulk);

                console.log('[repository] bulkWrite result:', {
                    insertedCount: (res as any).nInserted ?? (res as any).insertedCount ?? 0,
                    upsertedCount: (res as any).nUpserted ?? (res as any).upsertedCount ?? 0,
                    modifiedCount: (res as any).nModified ?? (res as any).modifiedCount ?? 0,
                });
            }
        } catch (err) {

            console.warn('[repository] refreshFromFetch failed', err);
        }
    }

    // Allow manual refresh trigger from external callers (e.g., admin route).
    async forceRefresh() {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        return this.refreshFromFetch();
    }

    private async readMatches(): Promise<MatchDocument[]> {
        if (!this.useMongo) {
            return this.matches;
        }

        return MatchModel.find({}, undefined, { sort: { id: 1 } }).lean<MatchDocument[]>();
    }

    private async writeMatch(id: number, patch: Partial<MatchDocument>): Promise<TournamentMatch> {
        if (!this.useMongo) {
            const index = this.matches.findIndex((match) => match.id === id);
            if (index < 0) {
                throw new Error(`Không tìm thấy trận #${id}`);
            }

            this.matches[index] = {
                ...this.matches[index],
                ...patch,
            };
            return decorateMatch(this.matches[index]);
        }

        const updated = await MatchModel.findOneAndUpdate({ id }, { $set: patch }, { new: true }).lean<MatchDocument>();
        if (!updated) {
            throw new Error(`Không tìm thấy trận #${id}`);
        }

        return decorateMatch(updated);
    }

    private async ensureEditablePrediction(id: number) {
        const matches = await this.readMatches();
        const locked = matches.filter((match) => Boolean(match.prediction)).length === matches.length;
        const current = matches.find((match) => match.id === id);

        if (!current) {
            throw new Error(`Không tìm thấy trận #${id}`);
        }

        if (locked && current.prediction) {
            throw new Error('Đã khóa dự đoán sau khi đủ 104 lượt.');
        }
    }

    async listMatches(): Promise<TournamentMatch[]> {
        const matches = await this.readMatches();
        return matches.map((match) => decorateMatch(match)).sort((left, right) => left.id - right.id);
    }

    async listPlayers(): Promise<PlayerListItem[]> {
        if (!this.useMongo) {
            throw new Error('Chức năng danh sách cầu thủ cần MongoDB collection players.');
        }

        const playerCollection = mongoose.connection.collection<PlayerDocument>('players');
        const players = await playerCollection
            .find({})
            .sort({ teamName: 1, number: 1, name: 1 })
            .toArray();

        return players.map((player) => ({
            playerId: player.playerId,
            apiId: player.apiId,
            name: player.name,
            age: player.age,
            number: player.number,
            photo: player.photo,
            position: player.position,
            teamCode: player.teamCode,
            teamName: player.teamName,
            teamId: player.teamId,
            group: player.group,
        }));
    }

    async getDashboard(): Promise<DashboardResponse> {
        const matches = await this.listMatches();
        const summary = buildSummary(matches);
        return {
            summary,
            matches,
            todayMatches: matches.filter((match) => match.dateKey === localDateKey()),
            ledger: buildLedger(matches),
            calendar: buildCalendar(matches),
            standings: buildStandings(matches),
        };
    }

    async getTeamLineup(teamName: string): Promise<TeamLineup> {
        const cleanedName = teamName.trim();
        if (!cleanedName || cleanedName.toLowerCase() === 'null') {
            return {
                teamName: 'Unknown',
                teamCode: 'UNK',
                group: 'TBD',
                formation: '4-4-2',
                formationSource: 'fallback',
                players: [],
                squadSize: 0,
            };
        }

        if (!this.useMongo) {
            return {
                teamName: cleanedName,
                teamCode: cleanedName.toUpperCase().slice(0, 3),
                group: 'TBD',
                formation: '4-4-2',
                formationSource: 'fallback',
                players: [],
                squadSize: 0,
            };
        }

        const normalizedInput = normalizeText(cleanedName);
        const playerCollection = mongoose.connection.collection<PlayerDocument>('players');
        const exactRegex = new RegExp(`^${escapeRegex(cleanedName)}$`, 'i');
        const players = await playerCollection
            .find({
                $or: [
                    { teamName: exactRegex },
                    { teamCode: exactRegex },
                ],
            })
            .sort({ number: 1, name: 1 })
            .toArray();

        const exactPlayers = players.length
            ? players
            : await playerCollection
                .find({})
                .sort({ number: 1, name: 1 })
                .toArray()
                .then((allPlayers) => allPlayers.filter((player) => normalizeText(player.teamName) === normalizedInput));

        if (exactPlayers.length === 0) {
            throw new Error(`Không tìm thấy cầu thủ của đội "${cleanedName}".`);
        }

        const firstPlayer = exactPlayers[0];
        const teamCollection = mongoose.connection.collection<TeamDocument>('teams');
        const teamDoc = await teamCollection.findOne({
            $or: [
                { teamId: firstPlayer.teamId },
                { teamCode: firstPlayer.teamCode },
                { teamName: new RegExp(`^${escapeRegex(firstPlayer.teamName)}$`, 'i') },
            ],
        });
        const formation = teamDoc?.formation?.trim() || '4-3-3';
        const formationSource = teamDoc?.formationSource?.trim() || 'default';
        const formationLines = parseFormation(formation);

        const byGroup = {
            GK: exactPlayers.filter((player) => positionGroup(player.position) === 'GK').sort(sortPlayer),
            DEF: exactPlayers.filter((player) => positionGroup(player.position) === 'DEF').sort(sortPlayer),
            MID: exactPlayers.filter((player) => positionGroup(player.position) === 'MID').sort(sortPlayer),
            ATT: exactPlayers.filter((player) => positionGroup(player.position) === 'ATT').sort(sortPlayer),
        };

        const selectedIds = new Set<string>();
        const lineupLines: Array<{ group: 'GK' | 'DEF' | 'MID' | 'ATT'; lineIndex: number; players: PlayerDocument[] }> = [
            { group: 'GK', lineIndex: -1, players: pickPlayers(byGroup.GK, 1, selectedIds) },
        ];

        formationLines.forEach((count, lineIndex) => {
            const group = formationLineGroup(lineIndex, formationLines.length);
            lineupLines.push({
                group,
                lineIndex,
                players: pickPlayers(byGroup[group], count, selectedIds),
            });
        });

        if (selectedIds.size < 11) {
            const remaining = exactPlayers
                .filter((player) => !selectedIds.has(player.playerId))
                .sort(sortPlayer);
            for (const player of remaining) {
                const group = positionGroup(player.position);
                const line = lineupLines.find((candidate) => candidate.group === group && candidate.players.length < (group === 'GK' ? 1 : 5))
                    ?? lineupLines.find((candidate) => candidate.players.length < 5)
                    ?? lineupLines[lineupLines.length - 1];
                line.players.push(player);
                selectedIds.add(player.playerId);
                if (selectedIds.size >= 11) break;
            }
        }

        const starters: LineupPlayer[] = [];
        lineupLines.forEach((line) => {
            line.players.forEach((player, index) => {
                const { x, y } = lineCoordinates(line.lineIndex, formationLines.length, index, line.players.length);
                const replacements: ReplacementPlayer[] = exactPlayers
                    .filter((candidate) =>
                        candidate.playerId !== player.playerId &&
                        candidate.position === player.position &&
                        candidate.teamName === player.teamName,
                    )
                    .sort(sortPlayer)
                    .slice(0, 5)
                    .map((candidate) => ({
                        playerId: candidate.playerId,
                        apiId: candidate.apiId,
                        name: candidate.name,
                        age: candidate.age,
                        number: candidate.number,
                        photo: candidate.photo,
                        position: candidate.position,
                    }));

                starters.push({
                    playerId: player.playerId,
                    apiId: player.apiId,
                    name: player.name,
                    age: player.age,
                    number: player.number,
                    photo: player.photo,
                    position: player.position,
                    teamCode: player.teamCode,
                    teamName: player.teamName,
                    teamId: player.teamId,
                    group: player.group,
                    x,
                    y,
                    replacements,
                });
            });
        });

        return {
            teamName: firstPlayer.teamName,
            teamCode: firstPlayer.teamCode,
            group: firstPlayer.group,
            formation: formationLines.join('-'),
            formationSource,
            players: starters.slice(0, 11),
            squadSize: exactPlayers.length,
        };
    }

    async updatePrediction(id: number, prediction: { predictedHomeScore: number; predictedAwayScore: number }) {
        await this.ensureEditablePrediction(id);
        const updated = await this.writeMatch(id, {
            prediction: {
                ...prediction,
                updatedAt: new Date().toISOString(),
            },
        });

        return updated;
    }
}


export async function createRepository() {
    const mongoUri = process.env.MONGODB_URI;
    const useMongo = Boolean(mongoUri);

    if (useMongo) {
        try {
            await mongoose.connect(mongoUri as string);
        } catch (error) {
            // eslint-disable-next-line no-console
            console.warn('MongoDB connection failed, falling back to memory store.', error);
        }
    }

    // Ensure indexes exist (will no-op if already created). If duplicates remain,
    // this may fail — keep it guarded so server still boots in memory-mode fallback.
    if (useMongo && mongoose.connection.readyState === 1) {
        try {
            // create indexes defined on the model (includes unique id)
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            await MatchModel.createIndexes();
            // Also ensure a compound unique index on dateKey/homeLabel/awayLabel to
            // protect against id-generation regressions (only if no duplicates exist).
            try {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                await MatchModel.collection.createIndex({ dateKey: 1, homeLabel: 1, awayLabel: 1 }, { unique: true, background: true });
            } catch (innerErr) {
                // ignore if index creation fails due to existing duplicates
                // eslint-disable-next-line no-console
                console.warn('[repository] compound unique index creation skipped or failed:', innerErr);
            }
        } catch (err) {
            // eslint-disable-next-line no-console
            console.warn('[repository] failed to create indexes:', err);
        }
    }

    const repository = new TournamentRepository(useMongo && mongoose.connection.readyState === 1);
    await repository.init();
    return repository;
}

export function toMatchLabel(match: TournamentMatch) {
    return `${formatDateKey(match.dateKey)}${match.timeLabel ? ` • ${match.timeLabel}` : ''}`;
}
