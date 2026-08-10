import { useCallback, useEffect, useMemo, useState } from 'react';
import { createTask, deleteTask, fetchTasks, updateTask } from './api';
import { PRIORITIES, type Priority, type Task } from './types';

export function App(): JSX.Element {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const next = await fetchTasks();
      setTasks(next);
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
      try {
        const created = await createTask({ title: trimmed, priority });
        setTasks((current) => [created, ...current]);
        setTitle('');
        setPriority('medium');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create task');
      }
    },
    [title, priority],
  );

  const handleToggle = useCallback(async (task: Task) => {
    try {
      const updated = await updateTask(task.id, { completed: !task.completed });
      setTasks((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update task');
    }
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteTask(id);
      setTasks((current) => current.filter((item) => item.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete task');
    }
  }, []);

  const remaining = useMemo(
    () => tasks.filter((task) => !task.completed).length,
    [tasks],
  );

  return (
    <main className="app">
      <header className="app__header">
        <h1>Task Manager</h1>
        <p className="app__subtitle">
          {loading ? 'Loading…' : `${remaining} open · ${tasks.length} total`}
        </p>
      </header>

      <form className="task-form" onSubmit={handleCreate}>
        <input
          className="task-form__title"
          type="text"
          placeholder="What needs to be done?"
          value={title}
          aria-label="Task title"
          onChange={(event) => setTitle(event.target.value)}
        />
        <select
          className="task-form__priority"
          value={priority}
          aria-label="Task priority"
          onChange={(event) => setPriority(event.target.value as Priority)}
        >
          {PRIORITIES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <button className="task-form__submit" type="submit" disabled={!title.trim()}>
          Add task
        </button>
      </form>

      {error && <p className="app__error" role="alert">{error}</p>}

      <ul className="task-list">
        {tasks.map((task) => (
          <li
            key={task.id}
            className={`task-item task-item--${task.priority} ${
              task.completed ? 'task-item--done' : ''
            }`}
          >
            <label className="task-item__label">
              <input
                type="checkbox"
                checked={task.completed}
                onChange={() => void handleToggle(task)}
              />
              <span className="task-item__title">{task.title}</span>
            </label>
            <span className={`task-item__badge task-item__badge--${task.priority}`}>
              {task.priority}
            </span>
            <button
              className="task-item__delete"
              type="button"
              aria-label={`Delete ${task.title}`}
              onClick={() => void handleDelete(task.id)}
            >
              ✕
            </button>
          </li>
        ))}
        {!loading && tasks.length === 0 && (
          <li className="task-list__empty">No tasks yet. Add your first one above.</li>
        )}
      </ul>
    </main>
  );
}
