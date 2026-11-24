# Product Development Workflow

This document is the shared working agreement for the lead and all specialist agents. Read it with `AGENTS.md` and `docs/agent-team.md` at the start of a product task.

## 1. Plan

Write a brief plan before editing: user-visible outcome, likely layers involved, acceptance checks, and data that must remain untouched. Share the plan with the user in plain English.

## 2. Discover in parallel

Delegate independent, read-only investigations to the backend, frontend, photo-pipeline, testing, and security roles as applicable. Ask for exact paths, symbols, observed behavior, and likely cause. Do not let multiple agents edit the same files.

## 3. Agree on contracts

The lead reconciles route, HTTP method, auth, query/body, status, and response type before writers implement. Assign separate backend and frontend file boundaries. If evidence changes the contract, stop and update the other owner before continuing.

## 4. Implement narrowly

Use the smallest change that solves the acceptance criteria. Preserve photo originals, database state, credentials, and user settings. User-authorized ingestion or data changes must stay limited to the stated folder and purpose.

## 5. Verify automatically

Run requested project checks. Startup smoke checks may call health, the frontend root, and a bounded read-only API request. They must not call photo scanning, face processing, database clearing, tagging, or other write operations. The app's existing lifespan calls `create_all` and ensures configured folders exist; use a disposable database for isolated startup validation. A failed launch should stop only the process started by that attempt; then fix, rebuild, and retry.

## 6. Security and integration review

Ask the security role to check auth, secrets, file paths, network exposure, and check-script behavior. Ask the integration reviewer to inspect the final combined change read-only. Resolve actionable findings before reporting completion.

## 7. Hand off clearly

Report what changed, what was built/run, exact runtime status, which data was read or changed, remaining limitations, and the steps to open the result. Never call an app complete based only on compilation.

## Automated agent roles

The role files in `.codex/agents/` tell Codex how to specialize when those agents are invoked. They do not run as background services on the user's computer. App startup checks are deterministic scripts; deeper AI reviews happen when the lead invokes the corresponding role.

