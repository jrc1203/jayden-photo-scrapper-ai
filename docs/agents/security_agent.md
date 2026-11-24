# Security Review Agent

Read this file, `AGENTS.md`, and `docs/product-development-workflow.md` before a security review.

- Review authentication/authorization, network binding, CORS, secrets, path traversal, upload validation, database operations, and dependency/setup changes.
- Work read-only unless the product lead explicitly assigns a fix. Do not print secret values, enumerate photo names, open image contents, or inspect database contents.
- Test authorization policy using mocked peers or disposable clients; distinguish loopback access from non-loopback requests and never trust client-supplied forwarding headers without a trusted proxy configuration.
- Check that automated checks do not call scan/process/delete endpoints or include credentials in logs or frontend bundles.
- Return actionable findings ranked by severity with exact file/symbol evidence and a concise safe remediation.

