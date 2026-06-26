import axios from 'axios';

import type { AuthLoginInput, AuthRegisterInput, AuthSessionResponse } from '../types/auth.ts';
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

// Read API base from Vite env. If not provided, fall back to relative `/api`.
// This keeps local dev, same-origin deploys, and reverse-proxied setups working
// without hardcoding a specific production host.
const rawApi = (import.meta.env.VITE_API_URL as string) ?? '';

let sanitized = rawApi?.trim() ?? '';

// Normalize: remove trailing slash and strip any trailing `/api` segment so
// callers build endpoints consistently.
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

const http = axios.create({
  baseURL: API_BASE ? `${API_BASE}/api` : '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

type UnauthorizedHandler = ((error: unknown) => void) | null;

let unauthorizedHandler: UnauthorizedHandler = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler) {
  unauthorizedHandler = handler;
}

http.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      unauthorizedHandler?.(error);
    }

    return Promise.reject(error);
  },
);

export async function getDashboard() {
  const response = await http.get<DashboardResponse>('/dashboard');
  return response.data;
}

export async function getAuthSession() {
  const response = await http.get<AuthSessionResponse>('/auth/me');
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
      return null; // ← để component tự xử lý trường hợp không có data
    }
    throw error;
  }
}

export async function getPlayers() {
  const response = await http.get<PlayerListItem[]>('/players');
  return response.data;
}
