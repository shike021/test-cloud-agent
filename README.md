# test-cloud-agent

A full-stack **Task Manager** used to validate the Cursor Cloud Agent development
environment end to end. It is an npm workspaces monorepo:

- `server/` — Express + TypeScript REST API backed by SQLite (`better-sqlite3`).
- `web/` — React + Vite + TypeScript single-page app that consumes the API.

## Requirements

- Node.js >= 20 (developed and tested on Node 22)
- npm >= 10
- A C/C++ toolchain (`build-essential`) for compiling `better-sqlite3`

## Getting started

```bash
npm ci          # install all workspace dependencies
npm run dev     # start the API (:3001) and the web app (:5173) together
```

Then open http://localhost:5173. The Vite dev server proxies `/api/*` to the
backend on port `3001`.

### Run the services individually

```bash
npm run dev:server   # API only, http://localhost:3001
npm run dev:web      # web only, http://localhost:5173
```

## Quality checks

```bash
npm run lint        # ESLint across all workspaces
npm run typecheck   # TypeScript type checking
npm run test        # server + web test suites
npm run build       # production build of the API and the web bundle
```

## API

Base URL: `http://localhost:3001`

| Method | Path              | Description                    |
| ------ | ----------------- | ------------------------------ |
| GET    | `/api/health`     | Liveness probe                 |
| GET    | `/api/tasks`      | List tasks (newest first)      |
| POST   | `/api/tasks`      | Create a task                  |
| GET    | `/api/tasks/:id`  | Fetch a single task            |
| PATCH  | `/api/tasks/:id`  | Update a task's fields/status  |
| DELETE | `/api/tasks/:id`  | Delete a task                  |

A task has the shape:

```json
{
  "id": "uuid",
  "title": "string",
  "description": "string",
  "status": "todo | in_progress | done",
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601"
}
```

## Configuration

The API reads these environment variables (all optional):

| Variable        | Default                     | Description                          |
| --------------- | --------------------------- | ------------------------------------ |
| `PORT`          | `3001`                      | API listen port                      |
| `DATABASE_FILE` | `server/data/tasks.sqlite`  | SQLite file path, or `:memory:`      |
| `CORS_ORIGIN`   | `*`                         | Allowed CORS origin                  |

The web dev server honors `VITE_API_TARGET` (default `http://localhost:3001`)
for the `/api` proxy target.

## Cloud Agent environment

`.cursor/environment.json` installs dependencies with `npm ci` and runs the API
and web dev servers as long-lived terminals, exposing ports `3001` and `5173`.
