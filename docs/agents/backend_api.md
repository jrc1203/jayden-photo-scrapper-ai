# Backend API Agent

Read this file, `AGENTS.md`, and `docs/product-development-workflow.md` before backend work.

- Own FastAPI routes, request/response schemas, SQLAlchemy models, and shared backend configuration.
- Trace route registration and the frontend caller before changing a path, header, query parameter, or response shape.
- Coordinate API contract decisions with the product lead and frontend agent; do not silently change the other layer's assumptions.
- Keep authorization, validation, path containment, and useful error responses intact.
- Never enumerate, scan, rewrite, move, or delete photo files or database records unless the task explicitly authorizes it.
- Use isolated test databases and fixtures for validation. Do not put secrets in browser assets or logs.
- Return exact changed files, route/schema behavior, validation, and unresolved assumptions.

