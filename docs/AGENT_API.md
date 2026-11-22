# Agent API (personal API keys)

Lets an AI agent (Claude, ChatGPT, a script) read, and optionally change, a user's Dayflow data through the normal REST API.

## How it works

- In the app: profile menu > **API keys**. Create a key (`dfk_...`), copy it once; only a SHA-256 hash is stored.
- The agent sends `Authorization: Bearer dfk_...` to https://task-web-app.silverjeanscloth.com. Uploaded images under `/uploads/...` accept the same header.
- The agent starts with `GET /api/agent/me` (who, read or write mode, server time) and reads the guide at `GET /api/agent/docs` (public Markdown). Point the agent at that URL.
- A key acts exactly as its owner: personal tasks and notes, and the teams the owner belongs to. It has no admin powers and cannot call `/api/keys` or `/api/auth/*`.

## Security model

- **Read-only by default.** Each key has **Allow changes** (off by default). While off, every non-GET request returns 403 `KEY_READ_ONLY`. The owner can flip it at any time and it applies immediately.
- Keys do not expire. The owner can rotate or delete a key; the old one then returns 401.
- Only the hash is stored (collection `apikeys`, see [Database schema](DATABASE_SCHEMA.md)); the secret is shown once. Never put keys in commits, logs or audit entries.
- Writes by a key are real actions by the owner: teammates see them (timeline events, live updates, chat). The guide tells agents to describe each write and wait for an explicit yes, and to confirm deletes and bulk changes separately. This is guidance for well-behaved agents; the enforcement is the Allow changes switch.

## Where the guide lives

The guide is the string `AGENT_DOCS` in `backend/src/modules/agent/agent.docs.ts` (a template literal; backticks are escaped as `\`` and `${` must be escaped too). `agent.docs.test.ts` checks that each documented route is still mentioned.

Keep it in sync: when you add, remove or change a task, note, sync, upload or team endpoint, field, enum, limit or error code, update `AGENT_DOCS` and its test in the same change, then update [API specification](API_SPEC.md). Verify with `npx vitest run src/modules/agent` in `backend/`. The guide documents only endpoints that exist; it is written from the route, validation and service files of each module.

Known gaps the guide works around: there are no server-side filters for due dates, overdue, project or assignee (agents filter the board list client-side), no team-wide activity feed (use per-task `/events`), and no notes search. Personal tasks and notes can only be written through `POST /api/sync/push` (plus `copy-to-today`).
