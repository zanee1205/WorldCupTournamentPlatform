import type { TeamLineup } from '../../shared/types/teamLineup.ts';
import type { PlayerListItem } from '../types/playerListItem.ts';

export type TeamLineupKey = string;

export interface PlayerListState {
  players: PlayerListItem[];
  playersLoading: boolean;
  playersLoaded: boolean;
  playersError: string | null;
  playersPromise: Promise<PlayerListItem[]> | null;
}

export interface PlayerListActions {
  loadPlayers(): Promise<PlayerListItem[]>;
}

export interface TeamLineupState {
  teamLineupPromises: Map<TeamLineupKey, Promise<TeamLineup | null>>;
  teamLineups: Map<TeamLineupKey, TeamLineup | null>;
  teamLineupLoading: Map<TeamLineupKey, boolean>;
  teamLineupErrors: Map<TeamLineupKey, string | null>;
}

export interface TeamLineupActions {
  getCachedTeamLineup(teamName: string): TeamLineup | null;
  isTeamLineupLoading(teamName: string): boolean;
  getTeamLineupError(teamName: string): string | null;
  loadTeamLineup(teamName: string): Promise<TeamLineup | null>;
}

export interface PlayerStoreState extends PlayerListState, TeamLineupState {}

export interface PlayerStoreActions extends PlayerListActions, TeamLineupActions {}

export interface PlayerStoreContract extends PlayerStoreState, PlayerStoreActions {}
