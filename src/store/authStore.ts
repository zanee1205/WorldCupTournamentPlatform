import { makeAutoObservable, runInAction } from 'mobx';
import { Modal } from 'antd';

import { appStore } from './matchStore.ts';
import { formatStoreError } from './storeUtils.ts';
import {
  getAuthSession,
  login as loginApi,
  logout as logoutApi,
  refreshAuthSession,
  updateMyProfile as updateMyProfileApi,
  register as registerApi,
  setUnauthorizedHandler,
} from '../services/apiService.ts';

import type { AuthLoginInput, AuthProfileUpdateInput, AuthRegisterInput, AuthSessionResponse, AuthUser } from '../types/auth.ts';
import type { AuthStoreContract, AuthStatus } from './authStore.types.ts';

let isShowingExpiryModal = false;

export class AuthStore implements AuthStoreContract {
  private static readonly ACCESS_TOKEN_KEY = 'access_token';

  status: AuthStatus = 'checking';
  user: AuthUser | null = null;
  accessToken: string | null = null;
  errorMessage: string | null = null;
  bootstrapPromise: Promise<AuthUser | null> | null = null;
  private hasShownExpiryModal = false;
  private expiryTimeoutId: number | null = null;

  constructor() {
    makeAutoObservable(
      this,
      {
        bootstrapPromise: false,
      },
      { autoBind: true },
    );
    setUnauthorizedHandler(this.handleUnauthorized);
  }

  isAuthenticated() {
    return this.status === 'authenticated' && Boolean(this.user);
  }

  private loadStoredAccessToken() {
    if (typeof window === 'undefined') {
      return null;
    }

    try {
      return window.localStorage.getItem(AuthStore.ACCESS_TOKEN_KEY)?.trim() || null;
    } catch {
      return null;
    }
  }

  private writeStoredAccessToken(accessToken: string | null) {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      if (accessToken) {
        window.localStorage.setItem(AuthStore.ACCESS_TOKEN_KEY, accessToken);
      } else {
        window.localStorage.removeItem(AuthStore.ACCESS_TOKEN_KEY);
      }
    } catch {
      // ignore storage write errors
    }
  }

  private clearStoredAccessTokens() {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.removeItem(AuthStore.ACCESS_TOKEN_KEY);
    } catch {
      // ignore storage errors
    }
  }

  private clearExpiryTimer() {
    if (typeof window === 'undefined') {
      return;
    }

    if (this.expiryTimeoutId !== null) {
      window.clearTimeout(this.expiryTimeoutId);
      this.expiryTimeoutId = null;
    }
  }

  private initializeFromStorage() {
    const storedAccessToken = this.loadStoredAccessToken();

    if (storedAccessToken) {
      runInAction(() => {
        this.accessToken = storedAccessToken;
      });
    }
  }

  private applySession(session: AuthSessionResponse, reason: string, resetApp = true) {
    if (resetApp) {
      appStore.reset();
    }

    runInAction(() => {
      this.user = session.user;
      this.status = 'authenticated';
      this.errorMessage = null;
      this.accessToken = session.accessToken;
    });

    this.writeStoredAccessToken(session.accessToken);
    this.scheduleExpiryCheck(session.accessToken);
    console.log('[auth] applied session', { reason, accessToken: session.accessToken });
  }

  private normalizeBase64Url(value: string) {
    let normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const paddingNeeded = 4 - (normalized.length % 4);
    if (paddingNeeded > 0 && paddingNeeded < 4) {
      normalized += '='.repeat(paddingNeeded);
    }
    return normalized;
  }

  private parseJwtExpiry(token: string): number | null {
    try {
      const payloadBase64 = token.split('.')[1];
      if (!payloadBase64) return null;
      const payloadJson = atob(this.normalizeBase64Url(payloadBase64));
      const payload = JSON.parse(payloadJson) as { exp?: number };
      return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
    } catch {
      return null;
    }
  }

  private scheduleExpiryCheck(accessToken: string) {
    this.clearExpiryTimer();

    const expiryMs = this.parseJwtExpiry(accessToken);
    if (!expiryMs) return;

    const refreshAt = expiryMs - Date.now() - 5_000;
    const timeoutMs = Math.max(0, refreshAt);

    if (timeoutMs <= 0) {
      void this.handleAccessTokenExpiry();
      return;
    }

    this.expiryTimeoutId = window.setTimeout(() => {
      void this.handleAccessTokenExpiry();
    }, timeoutMs);
  }

  private async handleAccessTokenExpiry() {
    try {
      console.log('[auth] access token expired, attempting refresh');
      const session = await refreshAuthSession();
      this.applySession(session, 'refresh', false);
      console.log('[auth] token refreshed successfully');
    } catch (error) {
      console.warn('[auth] refresh failed, marking unauthenticated', error);
      this.markUnauthenticated('refresh_failed');
    }
  }

  private clearSessionState() {
    this.clearStoredAccessTokens();
    this.clearExpiryTimer();

    runInAction(() => {
      this.user = null;
      this.accessToken = null;
      this.errorMessage = null;
    });
  }

  resetExpiryModal() {
    this.hasShownExpiryModal = false;
    isShowingExpiryModal = false;
  }

  markUnauthenticated(error?: unknown) {
    const reason = typeof error === 'string' ? error : 'unauthorized';

    const previousToken = this.accessToken;
    this.clearSessionState();

    runInAction(() => {
      this.status = 'unauthenticated';
    });

    console.log('[auth] access token expired or invalid', {
      reason,
      accessToken: previousToken,
    });

    appStore.reset();

    const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
    const isAuthEntryPage = currentPath === '/login' || currentPath === '/register';

    if (reason === 'logout' || isShowingExpiryModal || reason === 'bootstrap_401' || isAuthEntryPage) return;

    isShowingExpiryModal = true;
    Modal.destroyAll();

    Modal.confirm({
      title: 'Phiên đăng nhập đã hết hạn',
      content: 'Phiên đăng nhập đã hết hạn. Nhấn xác nhận để rời đi.',
      okText: 'Xác nhận',
      cancelText: 'Hủy',
      onOk: () => {
        isShowingExpiryModal = false;
        window.location.href = '/login';
      },
      onCancel: () => {
        isShowingExpiryModal = false;
      },
    });
  }

  handleUnauthorized(error: unknown) {
    if (typeof error === 'object' && error !== null && 'response' in error) {
      const response = (error as { response?: { status?: number } }).response;
      if (response?.status === 401 || response?.status === 423) {
        this.markUnauthenticated(response.status === 423 ? 'locked' : 'unauthorized');
      }
      return;
    }

    this.markUnauthenticated();
  }

  async bootstrap() {
    if (this.bootstrapPromise) {
      return this.bootstrapPromise;
    }

    this.initializeFromStorage();

    runInAction(() => {
      this.status = 'checking';
      this.errorMessage = null;
    });

    const request = getAuthSession({ skipUnauthorizedHandler: true })
      .then((session) => {
        this.applySession(session, 'bootstrap');
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
      this.applySession(session, 'login');
      return session.user;
    } catch (error) {
      // 401/423 là lỗi credentials, không phải hết phiên
      if (error && typeof error === 'object' && 'response' in error) {
        const response = (error as { response?: { status?: number } }).response;
        if (response?.status !== 401 && response?.status !== 423) {
          this.markUnauthenticated('login_failed');
          runInAction(() => {
            this.status = 'unauthenticated';
            this.errorMessage = formatStoreError(error, 'Không thể đăng nhập.');
          });
        }
      } else {
        this.markUnauthenticated('login_failed');
      }

      throw error; // LoginPage tự bắt và xử lý modal
    }
  }

  async register(payload: AuthRegisterInput) {
    runInAction(() => {
      this.errorMessage = null;
    });

    try {
      const session = await registerApi(payload);
      this.applySession(session, 'register');
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

  async updateProfile(payload: AuthProfileUpdateInput) {
    runInAction(() => {
      this.errorMessage = null;
    });

    const session = await updateMyProfileApi(payload);
    this.applySession(session, 'profile_update', false);
    return session.user;
  }
}

export const authStore = new AuthStore();
