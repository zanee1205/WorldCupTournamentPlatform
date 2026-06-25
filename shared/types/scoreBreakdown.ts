
export type MatchTrend = 'HOME' | 'AWAY' | 'DRAW' | null;
export interface ScoreBreakdown {
  stagePoints: number;
  exactPoints: number;
  totalPoints: number;
  predictedTrend: MatchTrend;
  actualTrend: MatchTrend;
  exactMatch: boolean;
}