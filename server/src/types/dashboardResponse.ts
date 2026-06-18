import {  DashboardSummary } from "./dashboardSummary.js";
import { GroupStandingBoard } from "./groupStanding.js";
import { ScoreLedgerEntry } from "./scoreLedgerEntry.js";
import { TournamentMatch } from "./tournamentMatch.js";

export interface DashboardResponse {
  summary: DashboardSummary;
  matches: TournamentMatch[];
  todayMatches: TournamentMatch[];
  ledger: ScoreLedgerEntry[];
  calendar: Record<string, TournamentMatch[]>;
  standings: GroupStandingBoard[];
}
