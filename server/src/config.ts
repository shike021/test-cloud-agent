import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));

export interface ServerConfig {
  port: number;
  databaseFile: string;
  corsOrigin: string;
}

function resolveDatabaseFile(): string {
  const configured = process.env.DATABASE_FILE?.trim();
  if (configured && configured.length > 0) {
    if (configured === ':memory:') {
      return configured;
    }
    return path.resolve(configured);
  }
  // Default to <repo>/server/data/tasks.sqlite
  return path.resolve(here, '..', 'data', 'tasks.sqlite');
}

export function loadConfig(): ServerConfig {
  const portRaw = process.env.PORT?.trim();
  const port = portRaw ? Number.parseInt(portRaw, 10) : 3001;
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid PORT value: ${String(portRaw)}`);
  }

  return {
    port,
    databaseFile: resolveDatabaseFile(),
    corsOrigin: process.env.CORS_ORIGIN?.trim() || '*',
  };
}
