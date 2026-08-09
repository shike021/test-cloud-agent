import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { openDatabase, type DatabaseHandle } from '../src/db.js';

describe('tasks API', () => {
  let db: DatabaseHandle;
  let app: Express;

  beforeEach(() => {
    db = openDatabase(':memory:');
    app = createApp({ db });
  });

  afterEach(() => {
    db.close();
  });

  it('reports health', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('starts with an empty task list', async () => {
    const res = await request(app).get('/api/tasks');
    expect(res.status).toBe(200);
    expect(res.body.tasks).toEqual([]);
  });

  it('creates, reads, updates and deletes a task', async () => {
    const createRes = await request(app)
      .post('/api/tasks')
      .send({ title: 'Write docs', description: 'Document the API' });
    expect(createRes.status).toBe(201);
    const { task } = createRes.body;
    expect(task.id).toBeTypeOf('string');
    expect(task.title).toBe('Write docs');
    expect(task.status).toBe('todo');

    const listRes = await request(app).get('/api/tasks');
    expect(listRes.body.tasks).toHaveLength(1);

    const patchRes = await request(app)
      .patch(`/api/tasks/${task.id}`)
      .send({ status: 'in_progress' });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.task.status).toBe('in_progress');
    expect(patchRes.body.task.updatedAt >= task.updatedAt).toBe(true);

    const deleteRes = await request(app).delete(`/api/tasks/${task.id}`);
    expect(deleteRes.status).toBe(204);

    const finalList = await request(app).get('/api/tasks');
    expect(finalList.body.tasks).toEqual([]);
  });

  it('rejects invalid task payloads', async () => {
    const res = await request(app).post('/api/tasks').send({ title: '' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('ValidationError');
  });

  it('returns 404 for unknown tasks', async () => {
    const res = await request(app).get('/api/tasks/does-not-exist');
    expect(res.status).toBe(404);
  });
});
