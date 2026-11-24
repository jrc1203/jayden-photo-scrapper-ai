# Parallel agent team

This project has a React + TypeScript frontend, a FastAPI + SQLAlchemy backend, and local photo and SQLite data. The roles below split work by those real ownership boundaries.

## Team roles

| Role | Use for | Owns | Avoids |
| --- | --- | --- | --- |
| `backend_api` | Endpoints, schemas, database behavior, settings | `backend/app/api/`, `models/`, `core/` | Frontend and photo-processing internals |
| `frontend_ui` | Gallery, people, tags, settings, mind map, client state | `frontend/src/` | Backend implementation |
| `photo_pipeline` | Scanning, metadata, thumbnails, face processing, performance | `backend/app/services/photo_scanner.py`, `face_recognition.py` | Frontend; uncoordinated shared model edits |
| `testing_agent` | Repeatable isolated API, build, startup, and regression checks | `backend/tests/`, `backend/scripts/`, `frontend` validation | Scanning, face-processing, or clearing user data as a test |
| `security_agent` | Read-only review of auth, network exposure, paths, secrets, and check behavior | Read-only across the repository | Printing secrets; opening photos; modifying app files |
| `integration_reviewer` | Pre-merge or post-change cross-layer review | Read-only across the repository | Editing files |
| `product_lead` | Plans and coordinates cross-layer implementation, validation, and handoff | Contract decisions, agent delegation, final integration | Competing edits in specialist-owned files |

Codex loads these project roles from `.codex/agents/`. The project config permits up to four concurrent subagent threads. Availability and whether a particular client exposes named roles can vary; if a role cannot be selected, pass its role instructions from the matching TOML file to a generic worker.

## How to parallelize

1. Keep `product_lead` responsible for requirements, scope, shared contracts, and final integration.
2. Start with read-only discovery when ownership or behavior is unclear. Ask each agent for exact file/symbol evidence and a short handoff.
3. Parallelize independent areas. For writes, assign disjoint files and name each owner's file boundary in the task.
4. Coordinate shared API, type, or SQLAlchemy changes through the parent. The parent resolves contract decisions before separate frontend/backend writers proceed.
5. After implementation, use `testing_agent` for isolated repeatable checks, `security_agent` for a read-only security review, and `integration_reviewer` for the combined diff. Report exactly what ran.

Avoid spawning one agent per file. A useful parallel task has independent work, clear ownership, and a result that can be integrated without competing edits. For a small change, one implementer plus a reviewer is usually enough.

## Suggested task prompts

### Independent frontend and backend work

> Have `backend_api` inspect and implement the route/schema change in the named backend files. In parallel, have `frontend_ui` inspect the relevant page and report the required client changes without editing the shared API contract yet. Reconcile the contract, then assign the client implementation. Finish with `integration_reviewer` reviewing the combined diff.

### Photo processing investigation

> Have `photo_pipeline` trace the scan/face-processing path and identify failure modes with file and symbol evidence. Keep this investigation read-only. Have `integration_reviewer` independently check path safety and data-loss risks. Summarize findings before assigning any edits.

### UI defect

> Have `frontend_ui` trace the page-to-API flow and implement the UI fix. Have `backend_api` independently verify the relevant response shape without editing files. After integration, ask `integration_reviewer` to check for contract regressions.

## Repository facts agents should keep in view

- The API client uses `/api/v1`; non-loopback API callers require `X-API-Key`, while local browser requests use the loopback-and-Origin policy in `backend/app/main.py`.
- The production FastAPI app serves `frontend/dist` when it exists, while development can run Vite separately.
- Photo paths and thumbnails are derived from configured local folders. Keep path traversal checks and database references consistent.
- Backend includes focused authorization and route-contract tests in `backend/tests/`; they do not start app lifespan or touch photo/database data.
- The frontend provides `npm run build` and `npm run lint`; the shared launcher runs authorization tests and a read-only health/root/gallery smoke check.
