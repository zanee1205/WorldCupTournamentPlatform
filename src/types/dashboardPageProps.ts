import type { DashboardResponse } from '../../server/src/types/dashboardResponse.js';
import type { TournamentMatch } from '../../shared/types/tournamentMatch.js';

export type DashboardPageProps = {
  dashboard: DashboardResponse;
  onOpenMatch: (match: TournamentMatch) => void;
};