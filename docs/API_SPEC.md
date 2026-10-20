# Dayflow — API Spec

Prefix `/api`. JSON. Auth: `Authorization: Bearer <jwt>`; the `dayflow_token` cookie is accepted **only for safe GET** requests. Every query is scoped by the JWT's userId; a client-sent `userId` is ignored.

Error shape: `{ "error": { "code": "STRING", "message": "text" } }`.
Common codes: 400 `VALIDATION_ERROR`, 401 `UNAUTHORIZED`, 403 `FORBIDDEN`, 404 `NOT_FOUND`, 409 `CONFLICT`, 429 `RATE_LIMITED`.

| Method | Path | Auth | Summary |
|---|---|---|---|
| GET | /health | none | `{ "ok": true }` |
| GET | /auth/config | none | `{ "googleClientId": string \| null }` |
| POST | /auth/google | none | Google ID token → session; rate-limited 10/min/IP |
| POST | /auth/logout | any | clears cookie |
| GET | /auth/me | Bearer or cookie | current user; refreshes cookie |
| GET | /users/stats | Bearer, superadmin | per-user counts (numbers only) |
| GET | /notes | Bearer | the user's notes (read fallback; writes go through /sync/push) |
| GET | /tasks?date= | Bearer | tasks of a day |
| GET | /tasks/dates?month= | Bearer | days with tasks |
| POST | /tasks/:id/copy-to-today | Bearer | server-side copy |
| POST | /sync/push | Bearer | batch upsert/delete |
| GET | /sync/pull?since= | Bearer | changes since |
| POST | /uploads | Bearer | multipart image |
| GET | /uploads/:userId/:file | cookie or Bearer | owner only |

## Auth
### GET /auth/config → 200 `{ "googleClientId": "…apps.googleusercontent.com" | null }`
### POST /auth/google
Req: `{ "credential": "<Google ID token from the Sign in with Google button>" }`
Res 200: `{ "token": "<jwt>", "user": { "id", "email", "name?", "role", "createdAt" } }` plus `Set-Cookie: dayflow_token=…; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000`.
The account is created on first sign-in. Every sign-in updates `lastLoginAt` and `loginCount`. Emails listed in `SUPERADMIN_EMAILS` become `superadmin`.
401 `INVALID_GOOGLE_TOKEN`; 403 `EMAIL_NOT_VERIFIED`; 503 `GOOGLE_NOT_CONFIGURED`; 429 when rate-limited.

### POST /auth/logout → 200 `{ "ok": true }` (cookie cleared).
### GET /auth/me → 200 `{ "user": {…} }` (role read from the database); a 401 clears the cookie.

## Users (superadmin only; the role is checked against the database on every call, others get 403)
### GET /users/stats
200:
```json
{ "totals": { "users": 3, "activeLast7d": 2, "tasks": 12, "notes": 4, "images": 2, "storageBytes": 1500 },
  "users": [ { "id", "email", "name", "role", "createdAt", "lastLoginAt", "loginCount",
               "tasks", "notes", "images", "storageBytes" } ] }
```
Numbers only: never titles, notes, images or any other content. Soft-deleted tasks and notes are not counted.

## Tasks
### GET /tasks?date=YYYY-MM-DD → `{ "tasks": [Task] }` (non-deleted, by orderIndex).
### GET /tasks/dates?month=YYYY-MM → `{ "dates": ["2026-10-18", …] }`.
### POST /tasks/:id/copy-to-today
Copies title/description/estimate into a new Dhaka-today task with `status: notStarted`, `copiedFromDate`, `copiedFromTaskId`, appended at the end. Original unchanged. 201 `{ "task": Task }`; 404 if not owned.

Task JSON:
```json
{ "id": "uuid", "taskDate": "2026-10-20", "title": "Write report", "descriptionHtml": "<p>…</p>",
  "descriptionText": "…", "estimatedMinutes": 90, "status": "notStarted", "orderIndex": 1024,
  "copiedFromDate": null, "copiedFromTaskId": null,
  "createdAt": "ISO", "updatedAt": "ISO", "deletedAt": null }
```

## Sync
### POST /sync/push
Req: `{ "changes": [ { "entity": "task"|"note", "op": "upsert"|"delete", "doc": {…}, "clientUpdatedAt": "ISO" } ] }` (≤ 100).
Each change's `doc` is the full document (a delete is a tombstone upsert: `op: "delete"` with `deletedAt` set). `clientUpdatedAt` is optional and defaults to `doc.updatedAt`.
Res 200: `{ "results": [ { "entity", "id", "applied": true|false, "winner": {…}|null, "error"?: "FORBIDDEN" } ], "serverTime": "ISO" }`, aligned with the request order. LWW: the strictly newer `updatedAt` wins; a losing client receives the server's `winner`. An id that belongs to another user returns `applied: false, winner: null, error: "FORBIDDEN"` and never touches that user's data. HTML is sanitized and `descriptionText` is recomputed server-side.
### GET /sync/pull?since=ISO
Res 200: `{ "tasks": [Task], "notes": [Note], "serverTime": "ISO" }`, tombstones included. Omit `since` for a full pull.
Pull filters on the server-side `serverUpdatedAt` (not the client's `updatedAt`), so an edit made offline long ago and pushed late still reaches other devices. `serverTime` is captured *before* reading, so a racing write is simply returned again next time (merges are idempotent).

## Uploads
### POST /uploads (multipart `file`; png/jpg/jpeg/webp/gif; ≤ 10 MB)
201 `{ "url": "/uploads/<userId>/<uuid>.webp", "width": 1600, "height": 900 }`. 400 bad type, 413 too large.
### GET /uploads/:userId/:file
Mounted at `/uploads` (not `/api`). A safe GET, so it accepts the httpOnly cookie (an `<img src>` cannot send headers) or a Bearer header. File names must match `<uuid>.webp|gif`.
Image with `Cache-Control: private, max-age=31536000, immutable`. 401 unauthenticated, 403 if `:userId` ≠ caller, 404 missing.
