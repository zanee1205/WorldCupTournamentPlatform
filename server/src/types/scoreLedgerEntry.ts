export interface ScoreLedgerEntry {
  matchId: number;
  title: string;
  stageLabel: string;
  dateKey: string;
  predictionText: string;
  resultText: string;
  trendText: string;
  stagePoints: number;
  exactPoints: number;
  totalPoints: number;
}