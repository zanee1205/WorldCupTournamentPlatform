export interface GoalScorer {
  team: string;
  player: string;
  minute: string | number;
}

export interface ResultInput {
  actualHomeScore: number;
  actualAwayScore: number;
  halftimeHomeScore?: number;
  halftimeAwayScore?: number;
  goals?: GoalScorer[];
};

export interface MatchResult extends ResultInput {
  updatedAt: string;
}
