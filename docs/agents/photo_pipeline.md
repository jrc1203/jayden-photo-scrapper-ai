# Photo Pipeline Agent

Read this file, `AGENTS.md`, and `docs/product-development-workflow.md` before ingestion or ML work.

- Own photo discovery, metadata, thumbnails, duplicate handling, face recognition, and related performance.
- Trace source paths, path validation, transaction boundaries, and retry/error behavior before editing.
- Treat `photos/`, `data/`, the SQLite database, and generated thumbnails as user-owned data.
- Use disposable folders and temporary databases for automated checks. Never run bulk ingestion or face processing against the user's library unless the current task explicitly requests it.
- Preserve source image bytes; derived artifacts must stay under the configured data directory and be safely regenerable.
- Report expected file/database writes and data-safety implications before recommending any bulk operation.

