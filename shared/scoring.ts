import type { MatchStage } from '../src/types/matchstage.js';
import type { MatchTrend, ScoreBreakdown } from './types/scoreBreakdown.js';
import type { MatchPrediction } from '../server/src/types/predictionInput.ts';
import type { MatchResult } from '../server/src/types/resultInput.js';

const STAGE_SCORE_TABLE: Record<MatchStage, { stagePoints: number; exactPoints: number }> = {
  group: { stagePoints: 1, exactPoints: 2 },
  round_of_32: { stagePoints: 2, exactPoints: 4 },
  round_of_16: { stagePoints: 2, exactPoints: 4 },
  quarterfinal: { stagePoints: 3, exactPoints: 6 },
  semifinal: { stagePoints: 3, exactPoints: 6 },
  third_place: { stagePoints: 3, exactPoints: 6 },
  final: { stagePoints: 4, exactPoints: 8 },
};

export function getStageScore(stage: MatchStage) {
  return STAGE_SCORE_TABLE[stage];
}

export function detectTrend(homeScore: number, awayScore: number): MatchTrend {
  if (homeScore === awayScore) {
    return 'DRAW';
  }

  return homeScore > awayScore ? 'HOME' : 'AWAY';
}

export function trendToVietnamese(trend: MatchTrend): string {
  if (trend === 'HOME') return 'chủ nhà thắng';
  if (trend === 'AWAY') return 'đội khách thắng';
  if (trend === 'DRAW') return 'hòa';
  return 'chưa có';
}

export function buildScoreBreakdown(
  stage: MatchStage,
  prediction: MatchPrediction,
  result: MatchResult,
): ScoreBreakdown {
  const stageScore = getStageScore(stage);
  const predictedTrend = detectTrend(prediction.predictedHomeScore, prediction.predictedAwayScore);
  const actualTrend = detectTrend(result.actualHomeScore, result.actualAwayScore);
  const exactMatch =
    prediction.predictedHomeScore === result.actualHomeScore &&
    prediction.predictedAwayScore === result.actualAwayScore;
  const trendMatched = predictedTrend === actualTrend;
  const exactPoints = trendMatched && exactMatch ? stageScore.exactPoints : 0;
  const stagePoints = trendMatched ? stageScore.stagePoints : 0;

  return {
    stagePoints,
    exactPoints,
    totalPoints: stagePoints + exactPoints,
    predictedTrend,
    actualTrend,
    exactMatch,
  };
}

export function pointsLabel(stage: MatchStage): string {
  const score = getStageScore(stage);
  return `${score.stagePoints}/${score.exactPoints}`;
}
