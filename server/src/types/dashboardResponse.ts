import { DashboardSummary } from "../../../src/types/dashboardSummary.js";
import { GroupStandingBoard } from "../../../shared/types/groupStanding.js";
import { ScoreLedgerEntry } from "../../../src/types/scoreLedgerEntry.js";
import { TournamentMatch } from "../../../shared/types/tournamentMatch.js";

export interface DashboardResponse {
  summary: DashboardSummary;
  matches: TournamentMatch[];
  todayMatches: TournamentMatch[];
  ledger: ScoreLedgerEntry[];
  calendar: Record<string, TournamentMatch[]>;
  standings: GroupStandingBoard[];
}
