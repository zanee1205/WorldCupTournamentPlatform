import { MatchPrediction } from '../../server/src/types/predictionInput.js';
import { MatchResult } from '../../server/src/types/resultInput.js';
import { ScoreBreakdown } from './scoreBreakdown.js';
import { MatchStage } from '../../src/types/matchstage.js';

export interface TournamentMatch {
  id: number;
  stage: MatchStage;
  stageLabel: string;
  dateKey: string;
  timeLabel: string | null;
  venue: string | null;
  groupLabel: string | null;
  homeLabel: string | null;
  awayLabel: string | null;
  title: string;
  note: string | null;
  prediction: MatchPrediction | null;
  result: MatchResult | null;
  score: ScoreBreakdown | null;
}