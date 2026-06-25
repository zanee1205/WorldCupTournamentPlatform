import type { WorldCupMatchCore } from './worldcupMatchCore.js';
import { WorldCupScore } from './worldCupScore.js';
import { WorldCupGoal } from './worldCupGoal.js';

export type WorldCupMatch = WorldCupMatchCore & {
    id: string;
    dateKey: string;
    timeLabel: string;
    homeTeam: string;
    awayTeam: string;
    status: 'scheduled' | 'finished';
    score: WorldCupScore | null;
    goals: WorldCupGoal[]
}