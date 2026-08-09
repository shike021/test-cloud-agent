import type { Priority, Task } from './types';

const BASE_URL = '/api';

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = (await response.json()) as { error?: string; message?: string };
      detail = body.message ?? body.error ?? detail;
    } catch {
      // Response had no JSON body; keep the status text.
    }
    throw new Error(`Request failed (${response.status}): ${detail}`);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export async function fetchTasks(): Promise<Task[]> {
  const response = await fetch(`${BASE_URL}/tasks`);
  const body = await handleResponse<{ tasks: Task[] }>(response);
  return body.tasks;
}

export async function createTask(input: {
  title: string;
  priority: Priority;
}): Promise<Task> {
  const response = await fetch(`${BASE_URL}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const body = await handleResponse<{ task: Task }>(response);
  return body.task;
}

export async function updateTask(
  id: string,
  input: Partial<Pick<Task, 'title' | 'priority' | 'completed'>>,
): Promise<Task> {
  const response = await fetch(`${BASE_URL}/tasks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const body = await handleResponse<{ task: Task }>(response);
  return body.task;
}

export async function deleteTask(id: string): Promise<void> {
  const response = await fetch(`${BASE_URL}/tasks/${id}`, { method: 'DELETE' });
  await handleResponse<void>(response);
}
