import { makeAutoObservable, runInAction } from 'mobx';

import { getDashboard, savePrediction as savePredictionApi } from '../services/apiService.ts';

import type { DashboardResponse } from '../../server/src/types/dashboardResponse.ts';
import type { TournamentMatch } from '../../shared/types/tournamentMatch.ts';

export type RefreshMode = 'initial' | 'background';

function formatError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export class MatchStore {
  dashboard: DashboardResponse | null = null;
  selectedMatch: TournamentMatch | null = null;
  loading = true;
  refreshing = false;
  errorMessage: string | null = null;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
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
}

export const appStore = new MatchStore();
export const matchStore = appStore;
