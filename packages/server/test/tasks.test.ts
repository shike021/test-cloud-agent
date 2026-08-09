import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { openDatabase, type DatabaseConnection } from '../src/db.js';
import { TaskRepository } from '../src/repository.js';

describe('tasks API', () => {
  let app: Express;
  let db: DatabaseConnection;

  beforeEach(() => {
    db = openDatabase(':memory:');
    app = createApp({ repository: new TaskRepository(db) });
  });

  afterEach(() => {
    db.close();
  });

  it('reports health', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });

  it('starts with an empty task list', async () => {
    const response = await request(app).get('/api/tasks');
    expect(response.status).toBe(200);
    expect(response.body.tasks).toEqual([]);
  });

  it('creates a task with defaults', async () => {
    const response = await request(app)
      .post('/api/tasks')
      .send({ title: 'Write documentation' });

    expect(response.status).toBe(201);
    expect(response.body.task).toMatchObject({
      title: 'Write documentation',
      priority: 'medium',
      completed: false,
    });
    expect(response.body.task.id).toBeTruthy();
  });

  it('rejects an invalid task payload', async () => {
    const response = await request(app).post('/api/tasks').send({ title: '' });
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('ValidationError');
  });

  it('updates and completes a task', async () => {
    const created = await request(app)
      .post('/api/tasks')
      .send({ title: 'Ship feature', priority: 'high' });
    const { id } = created.body.task;

    const updated = await request(app)
      .patch(`/api/tasks/${id}`)
      .send({ completed: true });

    expect(updated.status).toBe(200);
    expect(updated.body.task.completed).toBe(true);
    expect(updated.body.task.priority).toBe('high');
  });

  it('returns 404 when updating a missing task', async () => {
    const response = await request(app)
      .patch('/api/tasks/does-not-exist')
      .send({ completed: true });
    expect(response.status).toBe(404);
  });

  it('deletes a task', async () => {
    const created = await request(app).post('/api/tasks').send({ title: 'Temp' });
    const { id } = created.body.task;

    const deleted = await request(app).delete(`/api/tasks/${id}`);
    expect(deleted.status).toBe(204);

    const afterDelete = await request(app).get(`/api/tasks/${id}`);
    expect(afterDelete.status).toBe(404);
  });
});
