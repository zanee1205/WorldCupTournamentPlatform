import 'dotenv/config';
import { existsSync } from 'fs';
import path from 'path';
import express from 'express';

import aiRouter from './routes/ai.js';
import highlightRouter from './routes/highlightRouter.js';
import { requireAuth } from '../authentication/auth.js';

import { createApp } from './app.js';
import { createRepository } from './store.js';

const port = Number(process.env.PORT ?? 4000);

async function bootstrap() {
  const repository = await createRepository();
  const app = createApp(repository);

  app.use('/api/ai', requireAuth, aiRouter);
  app.use('/api/highlights', requireAuth, highlightRouter(repository));

  const distPath = path.resolve(process.cwd(), 'dist');
  const indexPath = path.join(distPath, 'index.html');

  if (existsSync(indexPath)) {
    app.use(express.static(distPath));
    app.get(/^\/(?!api(?:\/|$)).*/, (_request, response) => {
      response.sendFile(indexPath);
    });
  }

  app.listen(port, () => {
    console.log(`API server is running on http://localhost:${port}`);
  });
}

void bootstrap();
