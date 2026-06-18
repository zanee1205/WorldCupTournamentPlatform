import axios from 'axios';

import type { DashboardResponse } from '../server/src/types/dashboardResponse.ts';
import type { TournamentMatch } from '../server/src/types/tournamentMatch.ts';
import type { MatchPrediction } from '../server/src/types/predictionInput.ts';
import type { MatchResult } from '../server/src/types/resultInput.ts';

// Read API base from Vite env. If not provided, fall back to relative `/api`.
const rawApi = (import.meta.env.VITE_API_URL as string) ?? '';
// Blocklist known deprecated/removed hosts (Render) so deployed frontend won't call them.
const BLOCKLIST = ['onrender.com'];

let sanitized = rawApi?.trim() ?? '';
const lower = sanitized.toLowerCase();
if (sanitized && BLOCKLIST.some((b) => lower.includes(b))) {
  // eslint-disable-next-line no-console
  console.warn('[api] Ignoring VITE_API_URL because it points to a removed service:', sanitized);
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
  if (!API_BASE) return path; // keep behaviour: when no API_BASE use provided path (usually already starts with /api)
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



