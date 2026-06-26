import axios from 'axios';

import type { DashboardResponse } from '../../server/src/types/dashboardResponse.ts';
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
  headers: {
    'Content-Type': 'application/json',
  },
});

export async function getDashboard() {
  const response = await http.get<DashboardResponse>('/dashboard');
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
