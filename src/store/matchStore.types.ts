import type { DashboardSummary } from '../../src/types/dashboardSummary.ts';
import type { GroupStandingBoard } from '../../shared/types/groupStanding.ts';
import type { ScoreLedgerEntry } from '../../src/types/scoreLedgerEntry.ts';
import type { TournamentMatch } from '../../shared/types/tournamentMatch.ts';

export type RefreshMode = 'initial' | 'background';

export interface PredictionDraft {
  predictedHomeScore: number;
  predictedAwayScore: number;
}

export interface LoadableSliceState {
  loading: boolean;
  refreshing: boolean;
  loaded: boolean;
  errorMessage: string | null;
}

export interface ShellDashboardData {
  summary: DashboardSummary;
  todayMatches: TournamentMatch[];
}

export interface HomeDashboardData {
  calendar: Record<string, TournamentMatch[]>;
}

export interface LeaderboardDashboardData {
  standings: GroupStandingBoard[];
}

export interface MatchListDashboardData {
  matches: TournamentMatch[];
}

export interface DashboardStatsData {
  ledger: ScoreLedgerEntry[];
  maxPossiblePoints: number;
}

export interface ShellState extends LoadableSliceState {
  summary: DashboardSummary | null;
  todayMatches: TournamentMatch[];
}

export interface HomeState extends LoadableSliceState {
  calendar: Record<string, TournamentMatch[]> | null;
}

export interface LeaderboardState extends LoadableSliceState {
  standings: GroupStandingBoard[];
}

export interface MatchListState extends LoadableSliceState {
  matches: TournamentMatch[];
}

export interface DashboardStatsState extends LoadableSliceState {
  ledger: ScoreLedgerEntry[];
  maxPossiblePoints: number;
}

export interface MatchSelectionState {
  selectedMatch: TournamentMatch | null;
}

export interface MatchStoreShellActions {
  loadShell(mode?: RefreshMode): Promise<ShellDashboardData | null>;
}

export interface MatchStoreHomeActions {
  loadHome(mode?: RefreshMode): Promise<HomeDashboardData | null>;
}

export interface MatchStoreLeaderboardActions {
  loadLeaderboard(mode?: RefreshMode): Promise<LeaderboardDashboardData | null>;
}

export interface MatchStoreMatchListActions {
  loadMatchList(mode?: RefreshMode): Promise<MatchListDashboardData | null>;
}

export interface MatchStoreDashboardStatsActions {
  loadDashboardStats(mode?: RefreshMode): Promise<DashboardStatsData | null>;
}

export interface MatchStoreSelectionActions {
  openMatch(match: TournamentMatch): void;
  closeMatch(): void;
}

export interface MatchStorePredictionActions {
  savePrediction(matchId: number, prediction: PredictionDraft): Promise<void>;
}

export interface MatchStoreContract
  extends ShellState,
    HomeState,
    LeaderboardState,
    MatchListState,
    DashboardStatsState,
    MatchSelectionState,
    MatchStoreShellActions,
    MatchStoreHomeActions,
    MatchStoreLeaderboardActions,
    MatchStoreMatchListActions,
    MatchStoreDashboardStatsActions,
    MatchStoreSelectionActions,
    MatchStorePredictionActions {}
