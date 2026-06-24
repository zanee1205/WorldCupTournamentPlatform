import cors from 'cors';
import express from 'express';

import type { TournamentRepository } from './store.js';



export function createApp(repository: TournamentRepository) {
  const app = express();

  function isValidScore(value: unknown) {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 99;
  }

  // Configure allowed origins via environment variable for production flexibility.
  // Example: ALLOWED_ORIGINS="https://world-cup-tournament-platform.vercel.app,http://localhost:5173"
  const allowedOriginsEnv = String(process.env.ALLOWED_ORIGINS || 'https://world-cup-tournament-platform.vercel.app,http://localhost:5173');
  const allowedOrigins = allowedOriginsEnv.split(',').map((s) => s.trim()).filter(Boolean);

  app.use(cors({
    origin(origin, callback) {
      // allow non-browser requests (no Origin header)
      if (!origin) return callback(null, true);

      // Direct match against the configured list
      if (allowedOrigins.includes(origin)) return callback(null, true);

      // Allow wildcard entry
      if (allowedOrigins.includes('*')) return callback(null, true);

      // Allow any Vercel preview domain (e.g. *.vercel.app) so preview deployments can call the API.
      try {
        const url = new URL(origin);
        if (url.hostname.endsWith('.vercel.app')) return callback(null, true);
      } catch (err) {
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

  app.get('/api/dashboard', async (_request, response) => {
    const dashboard = await repository.getDashboard();
    response.json(dashboard);
  });

  app.get('/api/matches', async (_request, response) => {
    response.json(await repository.listMatches());
  });

  app.get('/api/players', async (_request, response) => {
    try {
      response.json(await repository.listPlayers());
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể tải danh sách cầu thủ.';
      response.status(500).json({ message });
    }
  });

  app.get('/api/teams/:teamName/lineup', async (request, response) => {
    try {
      const teamName = decodeURIComponent(String(request.params.teamName || ''));
      response.json(await repository.getTeamLineup(teamName));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể tải đội hình.';
      response.status(404).json({ message });
    }
  });

  // Proxy flags from flagcdn to avoid client-side external blocking
  app.get('/api/flag/:code', async (request, response) => {
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
    } catch (err) {
      response.status(500).json({ message: 'Flag proxy error' });
    }
  });

  app.patch('/api/matches/:id/prediction', async (request, response) => {
    try {
      const id = Number(request.params.id);
      const predictedHomeScore = Number(request.body?.predictedHomeScore);
      const predictedAwayScore = Number(request.body?.predictedAwayScore);

      // Debug logging to help diagnose deployed backend issues
      // (these logs appear in Render / service logs)
      // eslint-disable-next-line no-console
      console.log(`[api] PATCH /api/matches/${id}/prediction - payload=`, request.body);

      if (!Number.isInteger(id) || !isValidScore(predictedHomeScore) || !isValidScore(predictedAwayScore)) {
        response.status(400).json({ message: 'Dữ liệu dự đoán không hợp lệ.' });
        return;
      }

      const match = await repository.updatePrediction(id, {
        predictedHomeScore,
        predictedAwayScore,
      });

      // eslint-disable-next-line no-console
      console.log(`[api] updatePrediction success for match ${id}`, { prediction: match.prediction });

      response.json(match);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[api] updatePrediction error', error);
      const message = error instanceof Error ? error.message : 'Không thể cập nhật dự đoán.';
      response.status(message.includes('khóa dự đoán') ? 423 : 400).json({
        message,
      });
    }
  });

  app.post('/api/refresh', async (_request, response) => {
    try {
      // allow manual trigger for refresh (useful for debugging)
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      await repository.forceRefresh();
      response.json({ ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể refresh dữ liệu.';
      response.status(500).json({ message });
    }
  });



  return app;
}
