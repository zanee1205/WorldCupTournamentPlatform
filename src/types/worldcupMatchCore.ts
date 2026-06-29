import { OpenFootballGoal } from "./worldCupGoal";
import { OpenFootballScore } from "./openFootballScore";

export type WorldCupMatchCore = {
    num?: number;
    stage: string;
    round: string;
    group: string;
    date: string;
    time: string;
    venue: string;
}

export type OpenFootballMatch = Omit<WorldCupMatchCore, 'venue'> & {
    team1?: string;
    team2?: string;
    date?: string;
    time?: string;
    round?: string;
    group?: string;
    ground?: string;
    stage?: string;
    score?: OpenFootballScore;
    goals1?: OpenFootballGoal[];
    goals2?: OpenFootballGoal[];
}
