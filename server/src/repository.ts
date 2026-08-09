import { randomUUID } from 'node:crypto';
import type { DatabaseHandle } from './db.js';
import type { CreateTaskInput, Task, UpdateTaskInput } from './types.js';

interface TaskRow {
  id: string;
  title: string;
  description: string;
  status: Task['status'];
  created_at: string;
  updated_at: string;
}

function rowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class TaskRepository {
  constructor(private readonly db: DatabaseHandle) {}

  list(): Task[] {
    const rows = this.db
      .prepare<[], TaskRow>(
        `SELECT id, title, description, status, created_at, updated_at
         FROM tasks
         ORDER BY datetime(created_at) DESC, id DESC`,
      )
      .all();
    return rows.map(rowToTask);
  }

  get(id: string): Task | undefined {
    const row = this.db
      .prepare<[string], TaskRow>(
        `SELECT id, title, description, status, created_at, updated_at
         FROM tasks WHERE id = ?`,
      )
      .get(id);
    return row ? rowToTask(row) : undefined;
  }

  create(input: CreateTaskInput): Task {
    const now = new Date().toISOString();
    const task: Task = {
      id: randomUUID(),
      title: input.title,
      description: input.description,
      status: input.status,
      createdAt: now,
      updatedAt: now,
    };

    this.db
      .prepare(
        `INSERT INTO tasks (id, title, description, status, created_at, updated_at)
         VALUES (@id, @title, @description, @status, @createdAt, @updatedAt)`,
      )
      .run(task);

    return task;
  }

  update(id: string, input: UpdateTaskInput): Task | undefined {
    const existing = this.get(id);
    if (!existing) {
      return undefined;
    }

    const updated: Task = {
      ...existing,
      ...input,
      updatedAt: new Date().toISOString(),
    };

    this.db
      .prepare(
        `UPDATE tasks
         SET title = @title, description = @description, status = @status, updated_at = @updatedAt
         WHERE id = @id`,
      )
      .run(updated);

    return updated;
  }

  delete(id: string): boolean {
    const result = this.db.prepare(`DELETE FROM tasks WHERE id = ?`).run(id);
    return result.changes > 0;
  }
}
