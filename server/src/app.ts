import cors from 'cors';
import express from 'express';

import { createAuthRouter, requireAuth } from '../authentication/auth.js';
import type { TournamentRepository } from './store.js';

export function createApp(repository: TournamentRepository) {
  const app = express();

  function isValidScore(value: unknown) {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 99;
  }

  function currentUserId(response: express.Response) {
    return String(response.locals.authUser?.id ?? '');
  }

  const allowedOriginsEnv = String(process.env.ALLOWED_ORIGINS || 'https://world-cup-tournament-platform.vercel.app,http://localhost:5173');
  const allowedOrigins = allowedOriginsEnv.split(',').map((s) => s.trim()).filter(Boolean);

  app.use(cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      if (allowedOrigins.includes('*')) return callback(null, true);

      try {
        const url = new URL(origin);
        if (url.hostname.endsWith('.vercel.app')) return callback(null, true);
      } catch {
        // ignore parse errors and fall through to rejection
      }

      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  }));
  app.use(express.json());

  app.get('/api/health', (_request, response) => {
    response.json({ ok: true });
  });

  app.use('/api/auth', createAuthRouter());

  const protectedApi = express.Router();
  protectedApi.use(requireAuth);

  protectedApi.get('/dashboard', async (_request, response) => {
    response.json(await repository.getDashboard(currentUserId(response)));
  });

  protectedApi.get('/dashboard/shell', async (_request, response) => {
    response.json(await repository.getDashboardShell(currentUserId(response)));
  });

  protectedApi.get('/dashboard/home', async (_request, response) => {
    response.json(await repository.getDashboardHome(currentUserId(response)));
  });

  protectedApi.get('/dashboard/leaderboard', async (_request, response) => {
    response.json(await repository.getDashboardLeaderboard(currentUserId(response)));
  });

  protectedApi.get('/dashboard/matches', async (_request, response) => {
    response.json(await repository.getDashboardMatches(currentUserId(response)));
  });

  protectedApi.get('/dashboard/stats', async (_request, response) => {
    response.json(await repository.getDashboardStats(currentUserId(response)));
  });

  protectedApi.get('/matches', async (_request, response) => {
    response.json(await repository.listMatchesForUser(currentUserId(response)));
  });

  protectedApi.get('/players', async (_request, response) => {
    try {
      response.json(await repository.listPlayers());
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể tải danh sách cầu thủ.';
      response.status(500).json({ message });
    }
  });

  protectedApi.get('/teams/:teamName/lineup', async (request, response) => {
    try {
      const teamName = decodeURIComponent(String(request.params.teamName || ''));
      response.json(await repository.getTeamLineup(teamName));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể tải đội hình.';
      response.status(500).json({ message });
    }
  });

  protectedApi.get('/flag/:code', async (request, response) => {
    try {
      const code = String(request.params.code || '').toLowerCase();
      const size = String(request.query.size || '40');
      const format = String(request.query.format || 'png');

      const url = format === 'svg'
        ? `https://flagcdn.com/${code}.svg`
        : `https://flagcdn.com/w${size}/${code}.png`;

      const fetchRes = await fetch(url);
      if (!fetchRes.ok) {
        response.status(502).json({ message: 'Unable to fetch flag image' });
        return;
      }

      const contentType = fetchRes.headers.get('content-type') ?? (format === 'svg' ? 'image/svg+xml' : 'image/png');
      response.setHeader('Content-Type', contentType);
      const buffer = Buffer.from(await fetchRes.arrayBuffer());
      response.send(buffer);
    } catch {
      response.status(500).json({ message: 'Flag proxy error' });
    }
  });

  protectedApi.patch('/matches/:id/prediction', async (request, response) => {
    try {
      const id = Number(request.params.id);
      const predictedHomeScore = Number(request.body?.predictedHomeScore);
      const predictedAwayScore = Number(request.body?.predictedAwayScore);

      if (!Number.isInteger(id) || !isValidScore(predictedHomeScore) || !isValidScore(predictedAwayScore)) {
        response.status(400).json({ message: 'Dữ liệu dự đoán không hợp lệ.' });
        return;
      }

      const match = await repository.updatePrediction(currentUserId(response), id, {
        predictedHomeScore,
        predictedAwayScore,
      });

      response.json(match);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể cập nhật dự đoán.';
      response.status(message.includes('khóa dự đoán') ? 423 : 400).json({
        message,
      });
    }
  });

  protectedApi.post('/refresh', async (_request, response) => {
    try {
      await repository.forceRefresh();
      response.json({ ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể refresh dữ liệu.';
      response.status(500).json({ message });
    }
  });

  app.use('/api', protectedApi);

  return app;
}
