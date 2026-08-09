import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

export type DatabaseConnection = Database.Database;

/**
 * Opens a SQLite database connection and applies the schema.
 *
 * Pass ":memory:" for an ephemeral database (used by the test suite).
 * Any other path is created on disk, including parent directories.
 */
export function openDatabase(databasePath: string): DatabaseConnection {
  if (databasePath !== ':memory:') {
    fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  }

  const db = new Database(databasePath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate(db);
  return db;
}

function migrate(db: DatabaseConnection): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high')),
      completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1)),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks (created_at);
  `);
}
