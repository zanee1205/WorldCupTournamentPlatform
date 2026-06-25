import axios from 'axios';

import type { DashboardResponse } from '../../server/src/types/dashboardResponse.ts';
import type { MatchPrediction } from '../../server/src/types/predictionInput.ts';
import type { PlayerListItem } from '../../server/src/types/playerListItem.ts';
import type { TeamLineup } from '../../server/src/types/teamLineup.ts';
import type { TournamentMatch } from '../../server/src/types/tournamentMatch.ts';

// Read API base from Vite env. If not provided, fall back to relative `/api`.
const rawApi = (import.meta.env.VITE_API_URL as string) ?? '';

// When building for production and no `VITE_API_URL` is set, prefer the
// Render-hosted backend so the deployed frontend talks to the Render server.
const DEFAULT_RENDER_API = 'https://worldcuptournamentplatform.onrender.com';

// Keep blocklist empty by default to allow calling Render host. If you need to
// block specific hosts again, add them here.
const BLOCKLIST: string[] = [];

let sanitized = rawApi?.trim() ?? '';
if ((!sanitized || sanitized === '') && import.meta.env.PROD) {
  sanitized = DEFAULT_RENDER_API;
}

const lower = sanitized.toLowerCase();
if (sanitized && BLOCKLIST.some((b) => lower.includes(b))) {
  // eslint-disable-next-line no-console
  console.warn('[api] Ignoring VITE_API_URL because it points to a blocked service:', sanitized);
  sanitized = '';
}

// Normalize: remove trailing slash and strip any trailing `/api` segment so callers build endpoints consistently.
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

export async function getMatches() {
  const response = await http.get<TournamentMatch[]>('/matches');
  return response.data;
}

export async function savePrediction(matchId: number, payload: Omit<MatchPrediction, 'updatedAt'>) {
  const response = await http.patch<TournamentMatch>(`/matches/${matchId}/prediction`, payload);
  return response.data;
}

export async function getTeamLineup(teamName: string) {
  const response = await http.get<TeamLineup>(`/teams/${encodeURIComponent(teamName)}/lineup`);
  return response.data;
}

export async function getPlayers() {
  const response = await http.get<PlayerListItem[]>('/players');
  return response.data;
}
