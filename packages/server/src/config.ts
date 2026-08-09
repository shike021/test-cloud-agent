import { fileURLToPath } from 'node:url';
import path from 'node:path';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(currentDir, '..');

function parsePort(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0 || parsed > 65535) {
    throw new Error(`Invalid PORT value: ${value}`);
  }
  return parsed;
}

export interface AppConfig {
  port: number;
  host: string;
  databasePath: string;
  corsOrigin: string;
}

export function loadConfig(): AppConfig {
  const databasePath =
    process.env.DATABASE_PATH ?? path.join(packageRoot, 'data', 'tasks.db');

  return {
    port: parsePort(process.env.PORT, 4000),
    host: process.env.HOST ?? '0.0.0.0',
    databasePath,
    corsOrigin: process.env.CORS_ORIGIN ?? '*',
  };
}
