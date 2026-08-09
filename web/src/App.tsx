import { useCallback, useEffect, useMemo, useState } from 'react';
import { createTask, deleteTask, fetchTasks, updateTask } from './api';
import { STATUS_LABELS, TASK_STATUSES, type Task, type TaskStatus } from './types';

export function App(): JSX.Element {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      setTasks(await fetchTasks());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleCreate = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      const trimmed = title.trim();
      if (!trimmed) {
        return;
      }
      setSubmitting(true);
      setError(null);
      try {
        const created = await createTask({ title: trimmed, description: description.trim() });
        setTasks((prev) => [created, ...prev]);
        setTitle('');
        setDescription('');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create task');
      } finally {
        setSubmitting(false);
      }
    },
    [title, description],
  );

  const handleStatusChange = useCallback(async (task: Task, status: TaskStatus) => {
    try {
      const updated = await updateTask(task.id, { status });
      setTasks((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update task');
    }
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteTask(id);
      setTasks((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete task');
    }
  }, []);

  const counts = useMemo(() => {
    return TASK_STATUSES.reduce<Record<TaskStatus, number>>(
      (acc, status) => {
        acc[status] = tasks.filter((task) => task.status === status).length;
        return acc;
      },
      { todo: 0, in_progress: 0, done: 0 },
    );
  }, [tasks]);

  return (
    <div className="app">
      <header className="app__header">
        <h1>Task Manager</h1>
        <p className="app__subtitle">
          A full-stack demo used to validate the Cloud Agent development environment.
        </p>
        <div className="app__stats">
          {TASK_STATUSES.map((status) => (
            <span key={status} className={`badge badge--${status}`}>
              {STATUS_LABELS[status]}: {counts[status]}
            </span>
          ))}
        </div>
      </header>

      <form className="task-form" onSubmit={handleCreate}>
        <input
          className="task-form__title"
          type="text"
          placeholder="Task title"
          aria-label="Task title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={200}
          required
        />
        <textarea
          className="task-form__description"
          placeholder="Optional description"
          aria-label="Task description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          maxLength={2000}
          rows={2}
        />
        <button className="task-form__submit" type="submit" disabled={submitting || !title.trim()}>
          {submitting ? 'Adding…' : 'Add task'}
        </button>
      </form>

      {error && <p className="app__error" role="alert">{error}</p>}

      {loading ? (
        <p className="app__empty">Loading tasks…</p>
      ) : tasks.length === 0 ? (
        <p className="app__empty">No tasks yet. Add your first task above.</p>
      ) : (
        <ul className="task-list">
          {tasks.map((task) => (
            <li key={task.id} className={`task task--${task.status}`}>
              <div className="task__body">
                <h2 className="task__title">{task.title}</h2>
                {task.description && <p className="task__description">{task.description}</p>}
                <p className="task__meta">Created {new Date(task.createdAt).toLocaleString()}</p>
              </div>
              <div className="task__actions">
                <label className="task__status-label">
                  Status
                  <select
                    className="task__status"
                    aria-label={`Status for ${task.title}`}
                    value={task.status}
                    onChange={(event) => handleStatusChange(task, event.target.value as TaskStatus)}
                  >
                    {TASK_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {STATUS_LABELS[status]}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="task__delete"
                  type="button"
                  onClick={() => void handleDelete(task.id)}
                  aria-label={`Delete ${task.title}`}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
