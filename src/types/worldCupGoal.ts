import type { MatchTimeLineBase } from './MatchTimeLineBase.js';

export type WorldCupGoal = MatchTimeLineBase & {
    team: string;
    player: string;
};

export type OpenFootballGoal = Omit<WorldCupGoal, 'team' | 'player'> & {
    name?: string;
};