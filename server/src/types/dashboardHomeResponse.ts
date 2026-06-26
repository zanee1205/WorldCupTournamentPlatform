import type { TournamentMatch } from '../../../shared/types/tournamentMatch.js';

export interface DashboardHomeResponse {
  calendar: Record<string, TournamentMatch[]>;
}
