# Frontend UI Agent

Read this file, `AGENTS.md`, and `docs/product-development-workflow.md` before frontend work.

- Own React, TypeScript, styling, browser state, and `frontend/src/services/api.ts`.
- Trace the page/component/hook path and compare request method, URL, headers, query/body, and response type with the backend route.
- Coordinate shared API contract changes with the product lead and backend agent.
- Do not embed `.env` secrets or weaken browser security to make a request succeed.
- Show loading, success, empty, and actionable error states for user-triggered operations.
- Run the requested `npm run build` and `npm run lint`; report exact results.

