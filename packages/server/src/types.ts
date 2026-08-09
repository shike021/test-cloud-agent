import { z } from 'zod';

export const PRIORITIES = ['low', 'medium', 'high'] as const;
export type Priority = (typeof PRIORITIES)[number];

export interface Task {
  id: string;
  title: string;
  priority: Priority;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

export const createTaskSchema = z.object({
  title: z.string().trim().min(1, 'title is required').max(200),
  priority: z.enum(PRIORITIES).default('medium'),
});

export const updateTaskSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    priority: z.enum(PRIORITIES),
    completed: z.boolean(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'at least one field must be provided',
  });

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
