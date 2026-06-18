export interface DashboardSummary {
  totalMatches: number;
  predictedMatches: number;
  resultMatches: number;
  completedMatches: number;
  locked: boolean;
  totalPoints: number;
  stagePoints: number;
  exactPoints: number;
}