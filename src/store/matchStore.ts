import { makeAutoObservable, runInAction } from 'mobx';

import {
  getDashboardHome,
  getDashboardLeaderboard,
  getDashboardMatches,
  getDashboardShell,
  getDashboardStats,
  savePrediction as savePredictionApi,
} from '../services/apiService.ts';
import { formatStoreError } from './storeUtils.ts';

import type { DashboardSummary } from '../../src/types/dashboardSummary.ts';
import type { GroupStandingBoard } from '../../shared/types/groupStanding.ts';
import type { ScoreLedgerEntry } from '../../src/types/scoreLedgerEntry.ts';
import type { TournamentMatch } from '../../shared/types/tournamentMatch.ts';
import type {
  DashboardStatsData,
  HomeDashboardData,
  LeaderboardDashboardData,
  MatchListDashboardData,
  MatchStoreContract,
  PredictionDraft,
  RefreshMode,
  ShellDashboardData,
} from './matchStore.types.ts';

function normalizeError(error: unknown, fallback: string) {
  return formatStoreError(error, fallback);
}

function emptyCalendar(): Record<string, TournamentMatch[]> {
  return {};
}

export class MatchStore implements MatchStoreContract {
  loading = false;
  refreshing = false;
  loaded = false;
  errorMessage: string | null = null;

  summary: DashboardSummary | null = null;
  todayMatches: TournamentMatch[] = [];
  shellLoading = true;
  shellRefreshing = false;
  shellLoaded = false;
  shellErrorMessage: string | null = null;

  calendar: Record<string, TournamentMatch[]> | null = null;
  homeLoading = false;
  homeRefreshing = false;
  homeLoaded = false;
  homeErrorMessage: string | null = null;

  standings: GroupStandingBoard[] = [];
  leaderboardLoading = false;
  leaderboardRefreshing = false;
  leaderboardLoaded = false;
  leaderboardErrorMessage: string | null = null;

  matches: TournamentMatch[] = [];
  matchListLoading = false;
  matchListRefreshing = false;
  matchListLoaded = false;
  matchListErrorMessage: string | null = null;

  ledger: ScoreLedgerEntry[] = [];
  maxPossiblePoints = 0;
  dashboardLoading = false;
  dashboardRefreshing = false;
  dashboardLoaded = false;
  dashboardErrorMessage: string | null = null;

  selectedMatch: TournamentMatch | null = null;

  private shellPromise: Promise<ShellDashboardData | null> | null = null;
  private homePromise: Promise<HomeDashboardData | null> | null = null;
  private leaderboardPromise: Promise<LeaderboardDashboardData | null> | null = null;
  private matchListPromise: Promise<MatchListDashboardData | null> | null = null;
  private dashboardPromise: Promise<DashboardStatsData | null> | null = null;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  private syncSelectedMatchFromLoadedData() {
    const selectedId = this.selectedMatch?.id;
    if (selectedId == null) {
      return;
    }

    const fromMatches = this.matches.find((match) => match.id === selectedId);
    if (fromMatches) {
      this.selectedMatch = fromMatches;
      return;
    }

    const fromToday = this.todayMatches.find((match) => match.id === selectedId);
    if (fromToday) {
      this.selectedMatch = fromToday;
      return;
    }

    if (this.calendar) {
      for (const dayMatches of Object.values(this.calendar)) {
        const fromCalendar = dayMatches.find((match) => match.id === selectedId);
        if (fromCalendar) {
          this.selectedMatch = fromCalendar;
          return;
        }
      }
    }
  }

  private async refreshLoadedSlices() {
    const tasks: Array<Promise<unknown>> = [];

    if (this.shellLoaded) {
      tasks.push(this.loadShell('background'));
    }

    if (this.homeLoaded) {
      tasks.push(this.loadHome('background'));
    }

    if (this.leaderboardLoaded) {
      tasks.push(this.loadLeaderboard('background'));
    }

    if (this.matchListLoaded) {
      tasks.push(this.loadMatchList('background'));
    }

    if (this.dashboardLoaded) {
      tasks.push(this.loadDashboardStats('background'));
    }

    await Promise.all(tasks);
  }

  async loadShell(mode: RefreshMode = 'background') {
    if (mode === 'initial') {
      if (this.shellLoaded && this.summary) {
        return {
          summary: this.summary,
          todayMatches: this.todayMatches,
        };
      }

      if (this.shellPromise) {
        return this.shellPromise;
      }
    } else if (!this.shellLoaded && !this.shellPromise) {
      return null;
    } else if (this.shellPromise) {
      return this.shellPromise;
    }

    if (mode === 'initial') {
      this.shellLoading = true;
    } else {
      this.shellRefreshing = true;
    }

    this.shellErrorMessage = null;

    const request = getDashboardShell()
      .then((data) => {
        runInAction(() => {
          this.summary = data.summary;
          this.todayMatches = data.todayMatches;
          this.shellLoaded = true;
          this.shellErrorMessage = null;
          this.syncSelectedMatchFromLoadedData();
        });

        return data;
      })
      .catch((error: unknown) => {
        runInAction(() => {
          this.shellErrorMessage = normalizeError(error, 'KhÃ´ng táº£i Ä‘Æ°á»£c dá»¯ liá»‡u dashboard.');
        });

        throw error;
      })
      .finally(() => {
        runInAction(() => {
          this.shellLoading = false;
          this.shellRefreshing = false;
          this.shellPromise = null;
        });
      });

    this.shellPromise = request;
    return request;
  }

  async loadHome(mode: RefreshMode = 'background') {
    if (mode === 'initial') {
      if (this.homeLoaded && this.calendar) {
        return {
          calendar: this.calendar,
        };
      }

      if (this.homePromise) {
        return this.homePromise;
      }
    } else if (!this.homeLoaded && !this.homePromise) {
      return null;
    } else if (this.homePromise) {
      return this.homePromise;
    }

    if (mode === 'initial') {
      this.homeLoading = true;
    } else {
      this.homeRefreshing = true;
    }

    this.homeErrorMessage = null;

    const request = getDashboardHome()
      .then((data) => {
        runInAction(() => {
          this.calendar = data.calendar;
          this.homeLoaded = true;
          this.homeErrorMessage = null;
          this.syncSelectedMatchFromLoadedData();
        });

        return data;
      })
      .catch((error: unknown) => {
        runInAction(() => {
          this.homeErrorMessage = normalizeError(error, 'KhÃ´ng táº£i Ä‘Æ°á»£c lá»‹ch thi Ä‘áº¥u.');
        });

        throw error;
      })
      .finally(() => {
        runInAction(() => {
          this.homeLoading = false;
          this.homeRefreshing = false;
          this.homePromise = null;
        });
      });

    this.homePromise = request;
    return request;
  }

  async loadLeaderboard(mode: RefreshMode = 'background') {
    if (mode === 'initial') {
      if (this.leaderboardLoaded) {
        return {
          standings: this.standings,
        };
      }

      if (this.leaderboardPromise) {
        return this.leaderboardPromise;
      }
    } else if (!this.leaderboardLoaded && !this.leaderboardPromise) {
      return null;
    } else if (this.leaderboardPromise) {
      return this.leaderboardPromise;
    }

    if (mode === 'initial') {
      this.leaderboardLoading = true;
    } else {
      this.leaderboardRefreshing = true;
    }

    this.leaderboardErrorMessage = null;

    const request = getDashboardLeaderboard()
      .then((data) => {
        runInAction(() => {
          this.standings = data.standings;
          this.leaderboardLoaded = true;
          this.leaderboardErrorMessage = null;
        });

        return data;
      })
      .catch((error: unknown) => {
        runInAction(() => {
          this.leaderboardErrorMessage = normalizeError(error, 'KhÃ´ng táº£i Ä‘Æ°á»£c báº£ng xáº¿p háº¡ng.');
        });

        throw error;
      })
      .finally(() => {
        runInAction(() => {
          this.leaderboardLoading = false;
          this.leaderboardRefreshing = false;
          this.leaderboardPromise = null;
        });
      });

    this.leaderboardPromise = request;
    return request;
  }

  async loadMatchList(mode: RefreshMode = 'background') {
    if (mode === 'initial') {
      if (this.matchListLoaded) {
        return {
          matches: this.matches,
        };
      }

      if (this.matchListPromise) {
        return this.matchListPromise;
      }
    } else if (!this.matchListLoaded && !this.matchListPromise) {
      return null;
    } else if (this.matchListPromise) {
      return this.matchListPromise;
    }

    if (mode === 'initial') {
      this.matchListLoading = true;
    } else {
      this.matchListRefreshing = true;
    }

    this.matchListErrorMessage = null;

    const request = getDashboardMatches()
      .then((data) => {
        runInAction(() => {
          this.matches = data.matches;
          this.matchListLoaded = true;
          this.matchListErrorMessage = null;
          this.syncSelectedMatchFromLoadedData();
        });

        return data;
      })
      .catch((error: unknown) => {
        runInAction(() => {
          this.matchListErrorMessage = normalizeError(error, 'KhÃ´ng táº£i Ä‘Æ°á»£c danh sÃ¡ch tráº­n.');
        });

        throw error;
      })
      .finally(() => {
        runInAction(() => {
          this.matchListLoading = false;
          this.matchListRefreshing = false;
          this.matchListPromise = null;
        });
      });

    this.matchListPromise = request;
    return request;
  }

  async loadDashboardStats(mode: RefreshMode = 'background') {
    if (mode === 'initial') {
      if (this.dashboardLoaded) {
        return {
          ledger: this.ledger,
          maxPossiblePoints: this.maxPossiblePoints,
        };
      }

      if (this.dashboardPromise) {
        return this.dashboardPromise;
      }
    } else if (!this.dashboardLoaded && !this.dashboardPromise) {
      return null;
    } else if (this.dashboardPromise) {
      return this.dashboardPromise;
    }

    if (mode === 'initial') {
      this.dashboardLoading = true;
    } else {
      this.dashboardRefreshing = true;
    }

    this.dashboardErrorMessage = null;

    const request = getDashboardStats()
      .then((data) => {
        runInAction(() => {
          this.ledger = data.ledger;
          this.maxPossiblePoints = data.maxPossiblePoints;
          this.dashboardLoaded = true;
          this.dashboardErrorMessage = null;
        });

        return data;
      })
      .catch((error: unknown) => {
        runInAction(() => {
          this.dashboardErrorMessage = normalizeError(error, 'KhÃ´ng táº£i Ä‘Æ°á»£c thÃ´ng kÃª dashboard.');
        });

        throw error;
      })
      .finally(() => {
        runInAction(() => {
          this.dashboardLoading = false;
          this.dashboardRefreshing = false;
          this.dashboardPromise = null;
        });
      });

    this.dashboardPromise = request;
    return request;
  }

  openMatch(match: TournamentMatch) {
    this.selectedMatch = match;
  }

  closeMatch() {
    this.selectedMatch = null;
  }

  async savePrediction(matchId: number, prediction: PredictionDraft) {
    await savePredictionApi(matchId, prediction);
    await this.refreshLoadedSlices();
  }
}

export const appStore = new MatchStore();
export const matchStore = appStore;
