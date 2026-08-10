# Task Manager

A full-stack **Task Manager** used to exercise and validate the Cloud Agent
development environment end to end. It lives in the `task-manager/` directory of
this repository as a self-contained npm project — run every command below from
that directory, not from the repository root, which hosts the web arcade. It is a
TypeScript monorepo with two workspaces:

| Package | Stack | Responsibility |
| --- | --- | --- |
| `packages/server` (`@app/server`) | Node.js, Express, better-sqlite3, Zod | REST API with persistent SQLite storage |
| `packages/web` (`@app/web`) | React, Vite, TypeScript | Single-page UI that consumes the API |

## Prerequisites

- Node.js `>= 20` (the environment ships Node 22)
- npm `>= 10`

## Getting started

```bash
npm ci        # install all workspace dependencies
npm run dev   # start the API (:4000) and web app (:5173) together
```

Then open http://localhost:5173. The Vite dev server proxies `/api` requests to
the API on port `4000`.

## Available scripts (run from `task-manager/`)

| Command | Description |
| --- | --- |
| `npm run dev` | Run the API and web dev servers in parallel |
| `npm run dev:server` | Run only the API with hot reload |
| `npm run dev:web` | Run only the web dev server |
| `npm run build` | Type-check and build both packages for production |
| `npm run start` | Run the compiled API from `packages/server/dist` |
| `npm run lint` | Lint every workspace with ESLint |
| `npm run typecheck` | Type-check every workspace with `tsc` |
| `npm test` | Run the automated test suites |

## API reference

Base URL: `http://localhost:4000`

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Liveness probe with uptime |
| `GET` | `/api/tasks` | List all tasks |
| `POST` | `/api/tasks` | Create a task (`{ "title", "priority?" }`) |
| `GET` | `/api/tasks/:id` | Fetch a single task |
| `PATCH` | `/api/tasks/:id` | Update `title`, `priority`, or `completed` |
| `DELETE` | `/api/tasks/:id` | Delete a task |

A task has the shape:

```json
{
  "id": "uuid",
  "title": "string",
  "priority": "low | medium | high",
  "completed": false,
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601"
}
```

## Configuration

The API reads the following environment variables (all optional):

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `4000` | API listen port |
| `HOST` | `0.0.0.0` | API bind address |
| `DATABASE_PATH` | `packages/server/data/tasks.db` | SQLite file (use `:memory:` for ephemeral) |
| `CORS_ORIGIN` | `*` | Allowed CORS origin |

## Cloud Agent environment

The repository-level `.cursor/environment.json` provisions the web arcade at the
repository root, so this project's dependencies are not installed automatically.
Run `npm ci` in `task-manager/` before working on it. The web dev server defaults
to port `5173`, the same port the arcade uses, so pass `--port` to one of them
when both need to run at once.
