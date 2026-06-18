import { MatchPrediction } from './predictionInput.js';
import { MatchResult } from './resultInput.js';
import { ScoreBreakdown } from './scoreBreakdown.js';
import { MatchStage } from './matchstage.js';

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