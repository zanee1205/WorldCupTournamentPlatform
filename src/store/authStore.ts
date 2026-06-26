import { makeAutoObservable, runInAction } from 'mobx';

import { appStore } from './matchStore.ts';
import { formatStoreError } from './storeUtils.ts';
import {
  getAuthSession,
  login as loginApi,
  logout as logoutApi,
  register as registerApi,
  setUnauthorizedHandler,
} from '../services/apiService.ts';

import type { AuthLoginInput, AuthRegisterInput, AuthSessionResponse, AuthUser } from '../types/auth.ts';
import type { AuthStoreContract, AuthStatus } from './authStore.types.ts';

function formatCountdown(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

export class AuthStore implements AuthStoreContract {
  status: AuthStatus = 'checking';
  user: AuthUser | null = null;
  accessToken: string | null = null;
  accessTokenExpiresAt: string | null = null;
  errorMessage: string | null = null;
  bootstrapPromise: Promise<AuthUser | null> | null = null;
  tokenCountdownInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    makeAutoObservable(
      this,
      {
        bootstrapPromise: false,
        tokenCountdownInterval: false,
      },
      { autoBind: true },
    );
    setUnauthorizedHandler(this.markUnauthenticated);
  }

  isAuthenticated() {
    return this.status === 'authenticated' && Boolean(this.user);
  }

  private clearTokenCountdown() {
    if (this.tokenCountdownInterval) {
      clearInterval(this.tokenCountdownInterval);
      this.tokenCountdownInterval = null;
    }
  }

  private logTokenSnapshot(reason: string) {
    if (!this.accessToken || !this.accessTokenExpiresAt) {
      return;
    }

    const expiresAtMs = new Date(this.accessTokenExpiresAt).getTime();
    if (!Number.isFinite(expiresAtMs)) {
      console.log('[auth] access token snapshot', {
        reason,
        accessToken: this.accessToken,
        accessTokenExpiresAt: this.accessTokenExpiresAt,
      });
      return;
    }

    console.log('[auth] access token snapshot', {
      reason,
      accessToken: this.accessToken,
      accessTokenExpiresAt: this.accessTokenExpiresAt,
      remaining: formatCountdown(expiresAtMs - Date.now()),
    });
  }

  private startTokenCountdown(reason: string) {
    this.clearTokenCountdown();

    if (!this.accessToken || !this.accessTokenExpiresAt) {
      return;
    }

    this.logTokenSnapshot(reason);

    this.tokenCountdownInterval = setInterval(() => {
      if (!this.accessToken || !this.accessTokenExpiresAt) {
        this.clearTokenCountdown();
        return;
      }

      const expiresAtMs = new Date(this.accessTokenExpiresAt).getTime();
      if (!Number.isFinite(expiresAtMs)) {
        console.log('[auth] access token countdown reset', {
          accessToken: this.accessToken,
          accessTokenExpiresAt: this.accessTokenExpiresAt,
        });
        this.clearTokenCountdown();
        return;
      }

      const remainingMs = expiresAtMs - Date.now();
      if (remainingMs <= 0) {
        console.log('[auth] access token expired', {
          accessToken: this.accessToken,
          accessTokenExpiresAt: this.accessTokenExpiresAt,
        });
        this.clearTokenCountdown();
        return;
      }

      console.log('[auth] access token countdown', {
        remaining: formatCountdown(remainingMs),
      });
    }, 1000);
  }

  private setSession(session: AuthSessionResponse, reason: string) {
    appStore.reset();

    runInAction(() => {
      this.user = session.user;
      this.status = 'authenticated';
      this.errorMessage = null;
      this.accessToken = session.accessToken;
      this.accessTokenExpiresAt = session.accessTokenExpiresAt;
    });

    this.startTokenCountdown(reason);
  }

  private clearSessionState() {
    this.clearTokenCountdown();

    runInAction(() => {
      this.user = null;
      this.accessToken = null;
      this.accessTokenExpiresAt = null;
      this.errorMessage = null;
    });
  }

  markUnauthenticated(error?: unknown) {
    const reason = typeof error === 'string' ? error : 'unauthorized';
    const previousToken = this.accessToken;
    const previousExpiresAt = this.accessTokenExpiresAt;
    this.clearSessionState();

    runInAction(() => {
      this.status = 'unauthenticated';
    });

    console.log(`[auth] access token ${reason}`, {
      accessToken: previousToken,
      accessTokenExpiresAt: previousExpiresAt,
    });

    appStore.reset();
  }

  async bootstrap() {
    if (this.bootstrapPromise) {
      return this.bootstrapPromise;
    }

    runInAction(() => {
      this.status = 'checking';
      this.errorMessage = null;
    });

    const request = getAuthSession()
      .then((session) => {
        this.setSession(session, 'bootstrap');
        return session.user;
      })
      .catch((error) => {
        if (error && typeof error === 'object' && 'response' in error) {
          const response = (error as { response?: { status?: number } }).response;
          if (response?.status === 401) {
            this.markUnauthenticated('bootstrap_401');
            return null;
          }
        }

        this.clearSessionState();

        runInAction(() => {
          this.status = 'error';
          this.errorMessage = formatStoreError(error, 'Không thể xác thực phiên đăng nhập.');
          this.user = null;
        });
        throw error;
      })
      .finally(() => {
        this.bootstrapPromise = null;
      });

    this.bootstrapPromise = request;
    return request;
  }

  async login(payload: AuthLoginInput) {
    runInAction(() => {
      this.errorMessage = null;
    });

    try {
      const session = await loginApi(payload);
      this.setSession(session, 'login');
      return session.user;
    } catch (error) {
      this.markUnauthenticated('login_failed');

      if (error && typeof error === 'object' && 'response' in error) {
        const response = (error as { response?: { status?: number } }).response;
        if (response?.status !== 401) {
          runInAction(() => {
            this.status = 'unauthenticated';
            this.errorMessage = formatStoreError(error, 'Không thể đăng nhập.');
          });
        }
      }

      throw error;
    }
  }

  async register(payload: AuthRegisterInput) {
    runInAction(() => {
      this.errorMessage = null;
    });

    try {
      const session = await registerApi(payload);
      this.setSession(session, 'register');
      return session.user;
    } catch (error) {
      this.markUnauthenticated('register_failed');

      if (error && typeof error === 'object' && 'response' in error) {
        const response = (error as { response?: { status?: number } }).response;
        if (response?.status !== 401) {
          runInAction(() => {
            this.status = 'unauthenticated';
            this.errorMessage = formatStoreError(error, 'Không thể đăng ký.');
          });
        }
      }

      throw error;
    }
  }

  async logout() {
    try {
      await logoutApi();
    } finally {
      this.markUnauthenticated('logout');
    }
  }
}

export const authStore = new AuthStore();

