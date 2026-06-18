import axios from 'axios';

import type { DashboardResponse } from '../server/src/types/dashboardResponse.ts';
import type { TournamentMatch } from '../server/src/types/tournamentMatch.ts';
import type { MatchPrediction } from '../server/src/types/predictionInput.ts';
import type { MatchResult } from '../server/src/types/resultInput.ts';

// Read API base from Vite env. If not provided, fall back to relative `/api`.
export const API_BASE: string = (import.meta.env.VITE_API_URL as string) ?? '';

export function apiPath(path: string) {
  if (!path.startsWith('/')) path = `/${path}`;
  if (!API_BASE) return path;
  return `${API_BASE.replace(/\/$/, '')}${path}`;
}

const http = axios.create({
  baseURL: API_BASE ? `${API_BASE.replace(/\/$/, '')}/api` : '/api',
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



