import axios from 'axios';

import type { DashboardResponse } from '../server/src/types/dashboardResponse.ts';
import type { TournamentMatch } from '../server/src/types/tournamentMatch.ts';
import type { MatchPrediction } from '../server/src/types/predictionInput.ts';
import type { MatchResult } from '../server/src/types/resultInput.ts';

const http = axios.create({
  baseURL: '/api',
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



