# Repository agent guidance

## Project map

- `backend/app/api/` exposes FastAPI endpoints.
- `backend/app/models/` defines SQLAlchemy records and relations.
- `backend/app/core/` owns settings, database setup, and shared exceptions.
- `backend/app/services/` contains photo scanning, face recognition, and relationship logic.
- `frontend/src/services/api.ts` is the frontend API contract; `frontend/src/types/` holds matching TypeScript types.
- `frontend/src/pages/`, `components/`, and `hooks/` contain the React experience and client state.
- `data/` and `photos/` are user data locations. Treat their contents as valuable local data.

## Working agreements

- For work that benefits from parallel execution, use the focused roles in `.codex/agents/` and follow `docs/agent-team.md`.
- Delegate independent discovery and review in parallel. For code changes, assign one writer per file or clearly separated file set; do not have multiple agents edit the same area at once.
- Read the relevant implementation and caller/callee before changing a contract. Keep frontend API calls, backend routes, models, and types consistent.
- Preserve photo files and the local database. Do not delete, rewrite, or bulk-process user data as part of routine development tasks.
- Make the smallest change that solves the requested task. Do not add dependencies, tests, migrations, or broad refactors unless the task calls for them.
- When a task asks for validation, use the repository's existing commands: `npm run build` and `npm run lint` from `frontend/`, plus focused `pytest` checks from `backend/`. The launcher runs backend tests and a read-only startup check; those checks must not invoke photo scans, face processing, or database-clearing endpoints.
- Report changed files, behavior, validation performed, and any unresolved cross-layer assumptions.
