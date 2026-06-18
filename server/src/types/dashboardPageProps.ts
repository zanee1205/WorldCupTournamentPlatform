import type { DashboardResponse } from './dashboardResponse.js';
import type { TournamentMatch } from './tournamentMatch.js';

export type DashboardPageProps = {
  dashboard: DashboardResponse;
  onOpenMatch: (match: TournamentMatch) => void;
};