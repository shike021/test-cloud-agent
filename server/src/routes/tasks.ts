import { Router } from 'express';
import { ZodError } from 'zod';
import type { TaskRepository } from '../repository.js';
import { createTaskSchema, updateTaskSchema } from '../types.js';

export function createTasksRouter(repository: TaskRepository): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json({ tasks: repository.list() });
  });

  router.post('/', (req, res) => {
    try {
      const input = createTaskSchema.parse(req.body);
      const task = repository.create(input);
      res.status(201).json({ task });
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({ error: 'ValidationError', details: error.flatten() });
        return;
      }
      throw error;
    }
  });

  router.get('/:id', (req, res) => {
    const task = repository.get(req.params.id);
    if (!task) {
      res.status(404).json({ error: 'NotFound' });
      return;
    }
    res.json({ task });
  });

  router.patch('/:id', (req, res) => {
    try {
      const input = updateTaskSchema.parse(req.body);
      const task = repository.update(req.params.id, input);
      if (!task) {
        res.status(404).json({ error: 'NotFound' });
        return;
      }
      res.json({ task });
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({ error: 'ValidationError', details: error.flatten() });
        return;
      }
      throw error;
    }
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
