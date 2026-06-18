export interface PredictionInput {
  predictedHomeScore: number;
  predictedAwayScore: number;
};

export interface MatchPrediction extends PredictionInput {
  updatedAt: string;
}