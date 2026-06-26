import type { DashboardSummary } from '../../../src/types/dashboardSummary.js';
import type { TournamentMatch } from '../../../shared/types/tournamentMatch.js';

export interface DashboardShellResponse {
  summary: DashboardSummary;
  todayMatches: TournamentMatch[];
}
