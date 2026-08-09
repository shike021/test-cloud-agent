import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { openDatabase } from './db.js';
import { TaskRepository } from './repository.js';

function main(): void {
  const config = loadConfig();
  const db = openDatabase(config.databasePath);
  const repository = new TaskRepository(db);
  const app = createApp({ repository, corsOrigin: config.corsOrigin });

  const server = app.listen(config.port, config.host, () => {
    console.log(`API server listening on http://${config.host}:${config.port}`);
  });

  const shutdown = (signal: string): void => {
    console.log(`Received ${signal}, shutting down.`);
    server.close(() => {
      db.close();
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main();
