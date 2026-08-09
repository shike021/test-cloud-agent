import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

export type DatabaseHandle = Database.Database;

export function openDatabase(databaseFile: string): DatabaseHandle {
  if (databaseFile !== ':memory:') {
    const dir = path.dirname(databaseFile);
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(databaseFile);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate(db);
  return db;
}

function migrate(db: DatabaseHandle): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id          TEXT PRIMARY KEY,
      title       TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      status      TEXT NOT NULL DEFAULT 'todo'
                    CHECK (status IN ('todo', 'in_progress', 'done')),
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks (status);
    CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks (created_at);
  `);
}
