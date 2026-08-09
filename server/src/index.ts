import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { openDatabase } from './db.js';

function main(): void {
  const config = loadConfig();
  const db = openDatabase(config.databaseFile);
  const app = createApp({ db, corsOrigin: config.corsOrigin });

  const server = app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`[server] listening on http://localhost:${config.port} (db: ${config.databaseFile})`);
  });

  const shutdown = (signal: string): void => {
    // eslint-disable-next-line no-console
    console.log(`[server] received ${signal}, shutting down`);
    server.close(() => {
      db.close();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main();
