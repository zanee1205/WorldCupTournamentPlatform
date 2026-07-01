// import type { MatchTimeLineBase } from './MatchTimeLineBase.js';

import { MatchTimeLineBase } from "./matchTimeLineBase.js";

export type WorldCupGoal = MatchTimeLineBase & {
    team: string;
    player: string;
};

export type OpenFootballGoal = Omit<WorldCupGoal, 'team' | 'player'> & {
    name?: string;
};