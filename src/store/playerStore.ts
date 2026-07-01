import { makeAutoObservable, runInAction } from 'mobx';

import { getPlayers, getTeamLineup } from '../services/apiService.ts';
import { formatStoreError } from './storeUtils.ts';

import type { PlayerListItem } from '../types/playerListItem.ts';
import type { TeamLineup } from '../../shared/types/teamLineup.ts';
import type { PlayerStoreContract, TeamLineupKey } from './playerStore.types.ts';

function normalizeTeamName(teamName: string) {
  return teamName.trim().toLowerCase();
}

export class PlayerStore implements PlayerStoreContract {
  players: PlayerListItem[] = [];
  playersLoading = false;
  playersLoaded = false;
  playersError: string | null = null;
  playersPromise: Promise<PlayerListItem[]> | null = null;
  teamLineupPromises = new Map<TeamLineupKey, Promise<TeamLineup | null>>();
  teamLineups = new Map<TeamLineupKey, TeamLineup | null>();
  teamLineupLoading = new Map<TeamLineupKey, boolean>();
  teamLineupErrors = new Map<TeamLineupKey, string | null>();

  constructor() {
    makeAutoObservable(
      this,
      {
        playersPromise: false,
        teamLineupPromises: false,
      },
      { autoBind: true },
    );
  }

  async loadPlayers(): Promise<PlayerListItem[]> {
    if (this.playersLoaded) {
      return this.players;
    }

    if (this.playersPromise) {
      return this.playersPromise;
    }

    this.playersLoading = true;
    this.playersError = null;

    const request = getPlayers()
      .then((data) => {
        runInAction(() => {
          this.players = data;
          this.playersLoaded = true;
          this.playersError = null;
        });

        return data;
      })
      .catch((error: unknown) => {
        runInAction(() => {
          this.playersError = formatStoreError(error, 'Không thể lấy danh sách người choi.');
        });

        throw error;
      })
      .finally(() => {
        runInAction(() => {
          this.playersLoading = false;
          this.playersPromise = null;
        });
      });

    this.playersPromise = request;
    return request;
  }

  getCachedTeamLineup(teamName: string): TeamLineup | null {
    return this.teamLineups.get(normalizeTeamName(teamName)) ?? null;
  }

  isTeamLineupLoading(teamName: string): boolean {
    return this.teamLineupLoading.get(normalizeTeamName(teamName)) ?? false;
  }

  getTeamLineupError(teamName: string): string | null {
    return this.teamLineupErrors.get(normalizeTeamName(teamName)) ?? null;
  }

  async loadTeamLineup(teamName: string): Promise<TeamLineup | null> {
    const normalized = normalizeTeamName(teamName);
    if (!normalized) {
      return null;
    }

    const cached = this.teamLineups.get(normalized);
    if (cached) {
      return cached;
    }

    const inFlight = this.teamLineupPromises.get(normalized);
    if (inFlight) {
      return inFlight;
    }

    runInAction(() => {
      this.teamLineupLoading.set(normalized, true);
      this.teamLineupErrors.set(normalized, null);
    });

    const request = getTeamLineup(teamName.trim())
      .then((data) => {
        runInAction(() => {
          this.teamLineups.set(normalized, data);
          this.teamLineupErrors.delete(normalized);
        });

        return data;
      })
      .catch((error: unknown) => {
        runInAction(() => {
          this.teamLineupErrors.set(normalized, formatStoreError(error, `Không thể tải đội hình củ  a ${teamName}.`));
        });

        throw error;
      })
      .finally(() => {
        runInAction(() => {
          this.teamLineupLoading.delete(normalized);
          this.teamLineupPromises.delete(normalized);
        });
      });

    this.teamLineupPromises.set(normalized, request);
    return request;
  }
}

export const playerStore = new PlayerStore();
