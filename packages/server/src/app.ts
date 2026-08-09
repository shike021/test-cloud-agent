import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import type { TaskRepository } from './repository.js';
import { createTasksRouter } from './routes/tasks.js';

export interface AppOptions {
  repository: TaskRepository;
  corsOrigin?: string;
}

export function createApp({ repository, corsOrigin = '*' }: AppOptions): Express {
  const app = express();

  app.use(cors({ origin: corsOrigin }));
  app.use(express.json());

  const startedAt = Date.now();
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
      timestamp: new Date().toISOString(),
    });
  });

  app.use('/api/tasks', createTasksRouter(repository));

  app.use((_req, res) => {
    res.status(404).json({ error: 'NotFound' });
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    res.status(500).json({ error: 'InternalServerError', message });
  });

  return app;
}
