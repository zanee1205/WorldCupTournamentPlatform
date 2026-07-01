import axios from 'axios';

import type { AuthLoginInput, AuthProfileUpdateInput, AuthRegisterInput, AuthSessionResponse, AuthUser } from '../types/auth.ts';
import type { AdminDashboardResponse, AdminPasswordChangeRequest, AdminUnlockRequest, AdminUser } from '../types/admin.ts';
import type { DashboardResponse } from '../../server/src/types/dashboardResponse.ts';
import type { DashboardHomeResponse } from '../../server/src/types/dashboardHomeResponse.ts';
import type { DashboardLeaderboardResponse } from '../../server/src/types/dashboardLeaderboardResponse.ts';
import type { DashboardMatchesResponse } from '../../server/src/types/dashboardMatchesResponse.ts';
import type { DashboardShellResponse } from '../../server/src/types/dashboardShellResponse.ts';
import type { DashboardStatsResponse } from '../../server/src/types/dashboardStatsResponse.ts';
import type { MatchPrediction } from '../../server/src/types/predictionInput.ts';
import type { PlayerListItem } from '../types/playerListItem.ts';
import type { TeamLineup } from '../../shared/types/teamLineup.ts';
import type { TournamentMatch } from '../../shared/types/tournamentMatch.ts';

const rawApi = (import.meta.env.VITE_API_URL as string) ?? '';

let sanitized = rawApi?.trim() ?? '';

sanitized = sanitized.replace(/\/$/, '');
if (sanitized.toLowerCase().endsWith('/api')) {
  sanitized = sanitized.replace(/\/api$/i, '');
}

export const API_BASE: string = sanitized;

export function apiPath(path: string) {
  if (!path.startsWith('/')) path = `/${path}`;
  if (!API_BASE) return path;
  return `${API_BASE}${path}`;
}

const LOCAL_STORAGE_ACCESS_TOKEN_KEY = 'access_token';

export function getStoredAccessToken() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage.getItem(LOCAL_STORAGE_ACCESS_TOKEN_KEY)?.trim() || null;
  } catch {
    return null;
  }
}

export function setStoredAccessToken(accessToken: string | null) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    if (accessToken) {
      window.localStorage.setItem(LOCAL_STORAGE_ACCESS_TOKEN_KEY, accessToken);
    } else {
      window.localStorage.removeItem(LOCAL_STORAGE_ACCESS_TOKEN_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

const http = axios.create({
  baseURL: API_BASE ? `${API_BASE}/api` : '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

http.interceptors.request.use((config) => {
  const token = getStoredAccessToken();
  if (token) {
    config.headers = config.headers ?? {};

    if (!('Authorization' in config.headers)) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }

  return config;
});

type UnauthorizedHandler = ((error: unknown) => void) | null;

type HttpRequestConfig = import('axios').AxiosRequestConfig & {
  skipUnauthorizedHandler?: boolean;
};

let unauthorizedHandler: UnauthorizedHandler = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler) {
  unauthorizedHandler = handler;
}

let refreshingPromise: Promise<string | null> | null = null;

async function refreshAuthToken() {
  if (refreshingPromise) {
    return refreshingPromise;
  }

  refreshingPromise = http
    .post<AuthSessionResponse>('/auth/refreshNewToken', undefined, { skipUnauthorizedHandler: true } as HttpRequestConfig)
    .then((response) => {
      const accessToken = (response.data as AuthSessionResponse).accessToken;
      if (accessToken) {
        setStoredAccessToken(accessToken);
        console.log('[auth] refreshed access token from /auth/refreshNewToken', accessToken);
      }
      return accessToken;
    })
    .catch((error) => {
      setStoredAccessToken(null);
      throw error;
    })
    .finally(() => {
      refreshingPromise = null;
    });

  return refreshingPromise;
}

http.interceptors.response.use(
  (response) => {
    const updatedAccessToken = response.headers['x-access-token'];
    if (updatedAccessToken && typeof updatedAccessToken === 'string') {
      setStoredAccessToken(updatedAccessToken);
      console.log('[auth] refreshed access token from response header', updatedAccessToken);
    }
    return response;
  },
  async (error) => {
    if (axios.isAxiosError(error)) {
      const config = error.config as HttpRequestConfig | undefined;
      const isRefreshRequest = config?.url?.includes('/auth/refreshNewToken');

      if (error.response?.status === 401 && !config?.skipUnauthorizedHandler && !isRefreshRequest) {
        try {
          const newToken = await refreshAuthToken();
          if (newToken && config) {
            config.headers = config.headers ?? {};
            config.headers.Authorization = `Bearer ${newToken}`;
            return http(config);
          }
        } catch {
          // refresh failed, fall through to unauthorized handling
        }
      }

      if ((error.response?.status === 401 || error.response?.status === 423 || error.response?.status === 403) && !config?.skipUnauthorizedHandler) {
        unauthorizedHandler?.(error);
      }
    }

    return Promise.reject(error);
  },
);

export async function getDashboard() {
  const response = await http.get<DashboardResponse>('/dashboard');
  return response.data;
}

export async function refreshWorldcupFeed() {
  const response = await http.post('/refresh');
  return response.data;
}

export async function getAdminUsers() {
  const response = await http.get<{ users: AdminUser[]; count: number }>('/auth/admin/users');
  return response.data;
}

export async function getAdminDashboard() {
  const response = await http.get<AdminDashboardResponse>('/auth/admin/dashboard');
  return response.data;
}

export async function createPasswordChangeRequest(payload: { newPassword: string; reason?: string }) {
  const response = await http.post('/auth/password-change-requests', payload);
  return response.data;
}

export async function getPasswordChangeRequests() {
  const response = await http.get<{ requests: AdminPasswordChangeRequest[] }>('/auth/admin/password-change-requests');
  return response.data;
}

export async function approvePasswordChangeRequest(requestId: string) {
  const response = await http.patch(`/auth/admin/password-change-requests/${encodeURIComponent(requestId)}/approve`);
  return response.data;
}

export async function rejectPasswordChangeRequest(requestId: string) {
  const response = await http.patch(`/auth/admin/password-change-requests/${encodeURIComponent(requestId)}/reject`);
  return response.data;
}

export async function createUnlockRequest(payload: { identifier: string; reason?: string }) {
  const response = await http.post('/auth/unlock-requests', payload);
  return response.data;
}

export async function getUnlockRequests() {
  const response = await http.get<{ requests: AdminUnlockRequest[] }>('/auth/admin/unlock-requests');
  return response.data;
}

export async function approveUnlockRequest(requestId: string) {
  const response = await http.patch(`/auth/admin/unlock-requests/${encodeURIComponent(requestId)}/approve`);
  return response.data;
}

export async function rejectUnlockRequest(requestId: string) {
  const response = await http.patch(`/auth/admin/unlock-requests/${encodeURIComponent(requestId)}/reject`);
  return response.data;
}

export async function lockAdminUser(userId: string) {
  const response = await http.patch(`/auth/admin/users/${encodeURIComponent(userId)}/lock`);
  return response.data;
}

export async function unlockAdminUser(userId: string) {
  const response = await http.patch(`/auth/admin/users/${encodeURIComponent(userId)}/unlock`);
  return response.data;
}

export async function deleteAdminUser(userId: string) {
  const response = await http.delete(`/auth/admin/users/${encodeURIComponent(userId)}`);
  return response.data;
}

export async function getAuthSession(config?: HttpRequestConfig) {
  const response = await http.get<AuthSessionResponse>('/auth/me', config);
  return response.data;
}

export async function refreshAuthSession() {
  const response = await http.post<AuthSessionResponse>('/auth/refreshNewToken', undefined, {
    skipUnauthorizedHandler: true,
  } as HttpRequestConfig);
  return response.data;
}

export async function login(payload: AuthLoginInput) {
  const response = await http.post<AuthSessionResponse>('/auth/login', payload);
  return response.data;
}

export async function register(payload: AuthRegisterInput) {
  const response = await http.post<AuthSessionResponse>('/auth/register', payload);
  return response.data;
}

export async function logout() {
  const response = await http.post('/auth/logout');
  return response.data;
}

export async function updateMyProfile(payload: AuthProfileUpdateInput) {
  const response = await http.patch<AuthSessionResponse>('/auth/me', payload);
  return response.data;
}

export async function getDashboardShell() {
  const response = await http.get<DashboardShellResponse>('/dashboard/shell');
  return response.data;
}

export async function getDashboardHome() {
  const response = await http.get<DashboardHomeResponse>('/dashboard/home');
  return response.data;
}

export async function getDashboardLeaderboard() {
  const response = await http.get<DashboardLeaderboardResponse>('/dashboard/leaderboard');
  return response.data;
}

export async function getDashboardMatches() {
  const response = await http.get<DashboardMatchesResponse>('/dashboard/matches');
  return response.data;
}

export async function getDashboardStats() {
  const response = await http.get<DashboardStatsResponse>('/dashboard/stats');
  return response.data;
}

export async function savePrediction(matchId: number, payload: Omit<MatchPrediction, 'updatedAt'>) {
  const response = await http.patch<TournamentMatch>(`/matches/${matchId}/prediction`, payload);
  return response.data;
}

export async function getTeamLineup(teamName: string): Promise<TeamLineup | null> {
  try {
    const response = await http.get<TeamLineup>(`/teams/${encodeURIComponent(teamName)}/lineup`);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function getPlayers() {
  const response = await http.get<PlayerListItem[]>('/players');
  return response.data;
}
