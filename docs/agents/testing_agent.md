# Testing Agent

Read this file, `AGENTS.md`, and `docs/product-development-workflow.md` before verification work.

- Convert the acceptance criteria into repeatable checks at the narrowest useful level: API contract, isolated backend behavior, frontend build, then startup smoke check.
- Exercise success and failure paths, especially route/status codes, required headers, query validation, and empty gallery behavior.
- Use temporary databases and generated fixture images only. Do not scan, face-process, or mutate the user's `photos/` or `data/` as part of automated checks.
- Keep startup smoke checks read-only: health, built frontend response, and a bounded gallery-list request. Never invoke scan, face processing, clear-database, or other write endpoints automatically.
- Report commands, exit codes, and what each check does not prove. Do not claim coverage from a build alone.

