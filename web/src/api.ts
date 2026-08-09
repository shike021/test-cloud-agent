import type { Task, TaskStatus } from './types';

const BASE_URL = '/api';

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const body = (await response.json()) as { error?: string; message?: string };
      if (body.message) {
        message = body.message;
      } else if (body.error) {
        message = body.error;
      }
    } catch {
      // ignore body parse errors and keep the default message
    }
    throw new Error(message);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export async function fetchTasks(): Promise<Task[]> {
  const res = await fetch(`${BASE_URL}/tasks`);
  const body = await parseJson<{ tasks: Task[] }>(res);
  return body.tasks;
}

export async function createTask(input: {
  title: string;
  description?: string;
}): Promise<Task> {
  const res = await fetch(`${BASE_URL}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const body = await parseJson<{ task: Task }>(res);
  return body.task;
}

export async function updateTask(
  id: string,
  input: { status?: TaskStatus; title?: string; description?: string },
): Promise<Task> {
  const res = await fetch(`${BASE_URL}/tasks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const body = await parseJson<{ task: Task }>(res);
  return body.task;
}

export async function deleteTask(id: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/tasks/${id}`, { method: 'DELETE' });
  await parseJson<void>(res);
}
