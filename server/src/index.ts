import 'dotenv/config';
import aiRouter from './routes/ai.js';
import highlightRouter from './routes/highlightRouter.js';

import { createApp } from './app.js';
import { createRepository } from './store.js';

const port = Number(process.env.PORT ?? 4000);

async function bootstrap() {
  const repository = await createRepository();
  const app = createApp(repository);

  app.use('/api/ai', aiRouter);
  app.use('/api/highlights', highlightRouter(repository));

  app.listen(port, () => {
    console.log(`API server is running on http://localhost:${port}`);
  });
}

void bootstrap();
