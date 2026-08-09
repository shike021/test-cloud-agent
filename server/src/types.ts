import { z } from 'zod';

export const taskStatusValues = ['todo', 'in_progress', 'done'] as const;
export type TaskStatus = (typeof taskStatusValues)[number];

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
}

export const createTaskSchema = z.object({
  title: z.string().trim().min(1, 'title is required').max(200),
  description: z.string().trim().max(2000).optional().default(''),
  status: z.enum(taskStatusValues).optional().default('todo'),
});

export const updateTaskSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(2000).optional(),
    status: z.enum(taskStatusValues).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'at least one field must be provided',
  });

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
