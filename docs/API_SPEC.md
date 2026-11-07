# Dayflow — API Spec

## Rich content capability

Table-aware editors send `X-Dayflow-Rich-Content: tables-v1`. Sync upserts and
team task patches from clients without this capability cannot change a stored
table description (409 `EDITOR_UPDATE_REQUIRED`); unchanged descriptions and
ordinary older documents remain compatible. Sanitized HTML supports tables,
headers, bounded spans and cell alignment, with independent dimension/complexity
limits. See [rich text](RICH_TEXT.md) for paste behavior and client compatibility.

## Teams (web v1)

All `/api/teams` routes require auth. Writes require Bearer auth. Every team
service checks active membership; only the invite recipient can accept/decline.
Creator-only actions are enforced server-side. See [Teams](TEAMS.md).

| Method / path (prefix `/api/teams`) | Request / response |
| --- | --- |
| GET / | `{ teams }` with active members and open-task counts |
| POST / | `{ name }` → 201 `{ team }` |
| GET /invites | `{ invites }` for the signed-in recipient |
| POST /invites/:id/accept or /decline | `{ ok:true }` |
| GET /:id | `{ team }`, includes members, pending invites and historical people for attribution |
| DELETE /:id | Exact `{ name }` → `{ ok:true }`; creator only |
| POST /:id/invites | `{ email }` exact existing account → 201 `{ invite }` |
| DELETE /:id/invites/:inviteId | `{ ok:true }` |
| POST /:id/leave | `{ ok:true }`; creator cannot leave |
| DELETE /:id/members/:userId | `{ ok:true }`; creator only |
| GET /:id/tasks | `{ tasks }`; lazily archives Done tasks older than 24h |
| POST /:id/tasks | `{ title,descriptionHtml,status,assigneeId,estimatedDays }` → 201 `{ task }` |
| GET /:id/tasks/:taskId | `{ task }`, includes historical tasks |
| PATCH /:id/tasks/:taskId | `{ version,...editableFields,orderIndex? }` → `{ task }` |
| DELETE /:id/tasks/:taskId | `{ version }` → `{ ok:true }`; soft removal |
| POST /:id/tasks/:taskId/restore | `{ version }` → `{ task }`; returns to To do |
| GET /:id/history | `?kind=completed|removed&q=title&page=0` → `{ tasks,people,hasMore }`, 50/page |
| GET /:id/tasks/:taskId/events | `{ events,people }` |
| GET /:id/tasks/:taskId/messages | `?before=messageUuid` → `{ messages,people,hasMore }`, last 50 chronologically |
| POST /:id/tasks/:taskId/messages | `{ id:uuid,bodyText,bodyHtml }` → 201 `{ ok:true }`; retry idempotent |
| POST /:id/tasks/:taskId/read | `{ messageId }` → `{ ok:true }`; monotonically advances to that message's server time |
| POST /:id/uploads | Multipart file → 201 `{ url,width,height }` |

TeamStatus is todo/in_progress/completed. estimatedDays is null or a positive
integer; assigneeId is null or an active member. Identity, attribution and server
timestamps cannot be supplied by clients. Tasks include version, messageCount,
and per-user unread. Stale edits/removals/restores return 409
`{ error:{code:"TASK_CONFLICT",message},details:{task:latestTask} }`.

GET `/uploads/teams/:id/:file` rechecks auth/membership and returns
`Cache-Control: private, no-store`. No team content appears in personal sync.
Existing SSE `change` frames contain no content. Invites/messages/uploads/task
writes are rate limited; repeat invitations to a recipient/team have a one-hour
cooldown. Exact-email lookup exposes no directory. Team HTML is sanitized;
embedded images must use the current team's upload path.

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
| GET | /sync/events | Bearer client | user-scoped live change notifications |
| POST | /auth/desktop/start | none; rate-limited | create proof-bound sign-in request |
| GET | /auth/desktop/request/:requestId | Bearer or cookie | inspect pending confirmation code |
| POST | /auth/desktop/approve | Bearer | confirm account/code in browser |
| POST | /auth/desktop/exchange | verifier proof | poll/consume approved session once |
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
  "descriptionText": "…", "estimatedMinutes": 90, "status": "notStarted", "orderIndex": 1024, "reminderAt": null,
  "copiedFromDate": null, "copiedFromTaskId": null,
  "createdAt": "ISO", "updatedAt": "ISO", "deletedAt": null }
```

## Sync

`reminderAt` is a nullable UTC ISO timestamp. Older clients that omit it preserve
the stored reminder; explicit `null` clears it. Legacy records return `null`.
Copy-to-today starts without a reminder. Web, Windows and Android can edit the
field; only Android schedules local notifications in this release. A website edit
affects the phone's alarms after its next successful sync; there is no push service.

Android Google sign-in uses the existing `/auth/google` contract and requests an
ID token for the existing **web/server** OAuth client ID returned by `/auth/config`.
The Android package/signing-certificate client must be registered in the same
Google project. The Android client ID does not replace the backend's accepted
audience. Native networking sends Bearer auth for both APIs and private images.

### GET /sync/events

Authenticated SSE, consumed via fetch with Bearer auth. `event: change` / `data: {}` triggers ordinary push/pull and contains no documents. An initial event recovers missed changes. Heartbeat comments arrive every 20 seconds. Notifications are user-scoped. Disable proxy buffering; retain polling and reconnect backoff.

## Desktop sign-in

All following paths are under `/api/auth/desktop`; responses are `Cache-Control: no-store`. JWTs never enter URLs.

| Method/path | Request | Result |
| --- | --- | --- |
| POST `/start` | `{ challenge }`, SHA-256 of a random 43-character base64url verifier | 201 `{ requestId, code, expiresAt }`, five-minute lifetime |
| GET `/request/:requestId` | Authenticated browser session | `{ code, expiresAt }` for a pending request |
| POST `/approve` | Bearer auth, `{ requestId, code }`, explicit confirmation | `{ ok: true }`, binds account once |
| POST `/exchange` | `{ requestId, verifier }` | 202 `{ pending: true }` or 200 `{ token, user }`, atomic one-time consumption |

Invalid input returns 400; protected routes require authentication; invalid/expired/used requests return 410. Independent rate limits apply. Queries check expiry independently of TTL cleanup. The usual `/auth/me` restores the desktop image cookie after session import.

Production limits per IP per minute: start 10, inspection 40, approval 10, exchange 180. Limits are skipped in tests. Desktop rate limiting currently uses the middleware's default plain-text 429 response; clients should use its status rather than assume JSON for that response.

## Sync push and pull
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
