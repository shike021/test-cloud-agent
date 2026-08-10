import { Router } from 'express';
import type { TaskRepository } from '../repository.js';
import { createTaskSchema, updateTaskSchema } from '../types.js';

export function createTasksRouter(repository: TaskRepository): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json({ tasks: repository.list() });
  });

  router.post('/', (req, res) => {
    const parsed = createTaskSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'ValidationError', details: parsed.error.flatten() });
      return;
    }
    const task = repository.create(parsed.data);
    res.status(201).json({ task });
  });

  router.get('/:id', (req, res) => {
    const task = repository.findById(req.params.id);
    if (!task) {
      res.status(404).json({ error: 'NotFound' });
      return;
    }
    res.json({ task });
  });

  router.patch('/:id', (req, res) => {
    const parsed = updateTaskSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'ValidationError', details: parsed.error.flatten() });
      return;
    }
    const task = repository.update(req.params.id, parsed.data);
    if (!task) {
      res.status(404).json({ error: 'NotFound' });
      return;
    }
    res.json({ task });
  });

  router.delete('/:id', (req, res) => {
    const deleted = repository.delete(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'NotFound' });
      return;
    }
    res.status(204).send();
  });

  return router;
}
