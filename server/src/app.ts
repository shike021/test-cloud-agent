import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import type { DatabaseHandle } from './db.js';
import { TaskRepository } from './repository.js';
import { createTasksRouter } from './routes/tasks.js';

export interface AppOptions {
  db: DatabaseHandle;
  corsOrigin?: string;
}

export function createApp({ db, corsOrigin = '*' }: AppOptions): Express {
  const app = express();
  const repository = new TaskRepository(db);

  app.use(cors({ origin: corsOrigin }));
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  app.use('/api/tasks', createTasksRouter(repository));

  app.use((_req, res) => {
    res.status(404).json({ error: 'NotFound' });
  });

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    // eslint-disable-next-line no-console
    console.error('[server] unhandled error:', error);
    res.status(500).json({ error: 'InternalServerError', message });
  });

  return app;
}
