import { randomUUID } from 'node:crypto';
import type { DatabaseConnection } from './db.js';
import type { CreateTaskInput, Task, UpdateTaskInput } from './types.js';

interface TaskRow {
  id: string;
  title: string;
  priority: Task['priority'];
  completed: number;
  created_at: string;
  updated_at: string;
}

function rowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    priority: row.priority,
    completed: row.completed === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class TaskRepository {
  constructor(private readonly db: DatabaseConnection) {}

  list(): Task[] {
    const rows = this.db
      .prepare(
        'SELECT * FROM tasks ORDER BY completed ASC, created_at DESC',
      )
      .all() as TaskRow[];
    return rows.map(rowToTask);
  }

  findById(id: string): Task | null {
    const row = this.db
      .prepare('SELECT * FROM tasks WHERE id = ?')
      .get(id) as TaskRow | undefined;
    return row ? rowToTask(row) : null;
  }

  create(input: CreateTaskInput): Task {
    const now = new Date().toISOString();
    const task: Task = {
      id: randomUUID(),
      title: input.title,
      priority: input.priority,
      completed: false,
      createdAt: now,
      updatedAt: now,
    };

    this.db
      .prepare(
        `INSERT INTO tasks (id, title, priority, completed, created_at, updated_at)
         VALUES (@id, @title, @priority, @completed, @createdAt, @updatedAt)`,
      )
      .run({
        id: task.id,
        title: task.title,
        priority: task.priority,
        completed: task.completed ? 1 : 0,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
      });

    return task;
  }

  update(id: string, input: UpdateTaskInput): Task | null {
    const existing = this.findById(id);
    if (!existing) {
      return null;
    }

    const updated: Task = {
      ...existing,
      ...input,
      updatedAt: new Date().toISOString(),
    };

    this.db
      .prepare(
        `UPDATE tasks
         SET title = @title, priority = @priority, completed = @completed, updated_at = @updatedAt
         WHERE id = @id`,
      )
      .run({
        id,
        title: updated.title,
        priority: updated.priority,
        completed: updated.completed ? 1 : 0,
        updatedAt: updated.updatedAt,
      });

    return updated;
  }

  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
    return result.changes > 0;
  }
}
