import type { ScoreLedgerEntry } from '../../../src/types/scoreLedgerEntry.js';

export interface DashboardStatsResponse {
  ledger: ScoreLedgerEntry[];
  maxPossiblePoints: number;
}
