import { makeAutoObservable, runInAction } from 'mobx';

import { getDashboard, getPlayers, getTeamLineup, savePrediction as savePredictionApi } from '../api.ts';

import type { DashboardResponse } from '../../server/src/types/dashboardResponse.ts';
import type { PlayerListItem } from '../../server/src/types/playerListItem.ts';
import type { TeamLineup } from '../../server/src/types/teamLineup.ts';
import type { TournamentMatch } from '../../server/src/types/tournamentMatch.ts';

export type RefreshMode = 'initial' | 'background';

function formatError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function normalizeTeamName(teamName: string) {
  return teamName.trim().toLowerCase();
}

export class AppStore {
  dashboard: DashboardResponse | null = null;
  selectedMatch: TournamentMatch | null = null;
  loading = true;
  refreshing = false;
  errorMessage: string | null = null;
  players: PlayerListItem[] = [];
  playersLoading = false;
  playersLoaded = false;
  playersError: string | null = null;
  playersPromise: Promise<PlayerListItem[]> | null = null;
  teamLineupPromises = new Map<string, Promise<TeamLineup | null>>();
  teamLineups = new Map<string, TeamLineup>();
  teamLineupLoading = new Map<string, boolean>();
  teamLineupErrors = new Map<string, string | null>();

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

  async refresh(mode: RefreshMode = 'background') {
    if (mode === 'initial') {
      this.loading = true;
    } else {
      this.refreshing = true;
    }

    try {
      const data = await getDashboard();
      runInAction(() => {
        this.dashboard = data;
        this.errorMessage = null;

        if (this.selectedMatch) {
          const updatedMatch = data.matches.find((match) => match.id === this.selectedMatch?.id);
          if (updatedMatch) {
            this.selectedMatch = updatedMatch;
          }
        }
      });
      return data;
    } catch (error) {
      runInAction(() => {
        this.errorMessage = formatError(error, 'Không tải được dữ liệu.');
      });
      throw error;
    } finally {
      runInAction(() => {
        this.loading = false;
        this.refreshing = false;
      });
    }
  }

  openMatch(match: TournamentMatch) {
    this.selectedMatch = match;
  }

  closeMatch() {
    this.selectedMatch = null;
  }

  async savePrediction(matchId: number, prediction: { predictedHomeScore: number; predictedAwayScore: number }) {
    await savePredictionApi(matchId, prediction);
    await this.refresh('background');
  }

  async loadPlayers() {
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
          this.playersError = formatError(error, 'Không tải được danh sách cầu thủ.');
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

  getCachedTeamLineup(teamName: string) {
    return this.teamLineups.get(normalizeTeamName(teamName)) ?? null;
  }

  isTeamLineupLoading(teamName: string) {
    return this.teamLineupLoading.get(normalizeTeamName(teamName)) ?? false;
  }

  getTeamLineupError(teamName: string) {
    return this.teamLineupErrors.get(normalizeTeamName(teamName)) ?? null;
  }

  async loadTeamLineup(teamName: string) {
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
          this.teamLineupErrors.set(normalized, formatError(error, `Không tải được đội hình của ${teamName}.`));
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

export const appStore = new AppStore();
