import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';
import type { Task } from './types';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('App', () => {
  it('renders tasks returned from the API', async () => {
    const task: Task = {
      id: '1',
      title: 'Existing task',
      description: 'From the server',
      status: 'todo',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ tasks: [task] }));

    render(<App />);

    expect(await screen.findByText('Existing task')).toBeInTheDocument();
  });

  it('creates a task through the form', async () => {
    const created: Task = {
      id: '2',
      title: 'Brand new task',
      description: '',
      status: 'todo',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ tasks: [] }))
      .mockResolvedValueOnce(jsonResponse({ task: created }, 201));

    render(<App />);

    await screen.findByText('No tasks yet. Add your first task above.');

    await userEvent.type(screen.getByLabelText('Task title'), 'Brand new task');
    await userEvent.click(screen.getByRole('button', { name: 'Add task' }));

    await waitFor(() => expect(screen.getByText('Brand new task')).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/tasks',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
