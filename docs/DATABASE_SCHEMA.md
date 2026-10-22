# Dayflow — Database Schema

MongoDB 7 via Mongoose. Domain models use `I<Entity>` interfaces and string UUID IDs. Desktop handoff request IDs are random hex strings, as specified below. Timestamps are stored as UTC and displayed in Asia/Dhaka.

## desktoprequests (desktop authentication)

Ephemeral Mongoose collection: `_id` is a random 48-character hex request ID; `challenge` is a SHA-256 base64url verifier hash; `code` is a six-digit confirmation code; `userId` starts null and is set on explicit browser approval; `expiresAt` has a TTL index with `expireAfterSeconds: 0`. Queries enforce the five-minute expiry even before TTL cleanup. Atomic `findOneAndDelete` consumes an approved request once. No raw verifier or JWT is stored. Existing task/note schemas are unchanged.

## users
| Field | Type | Notes |
|---|---|---|
| _id | string (uuid) | |
| email | string | lowercase, from the Google account, indexed |
| googleId | string | Google `sub`, unique |
| name | string | optional, from Google |
| role | `"superadmin" \| "user"` | `superadmin` set via `SUPERADMIN_EMAILS` on sign-in, or by editing the document |
| lastLoginAt | Date | updated on every sign-in |
| loginCount | number | incremented on every sign-in |
| createdAt, updatedAt | Date | |

Indexes: `{ googleId: 1 }` unique, `{ email: 1 }`. There are no passwords.

## tasks
| Field | Type | Notes |
|---|---|---|
| _id | string (uuid) | client-generated |
| userId | string | from JWT, indexed |
| taskDate | string `YYYY-MM-DD` | Dhaka day; ≤ Dhaka today + 1 |
| title | string | 1–200, required |
| descriptionHtml | string | sanitized |
| descriptionText | string | first 300 chars of plain text |
| estimatedMinutes | number | 0–1439 |
| status | `"notStarted" \| "started" \| "completed"` | |
| reminderAt | Date \| null | One-time reminder; UTC storage, Dhaka input/display; default null |
| orderIndex | number | fractional |
| copiedFromDate | string \| null | |
| copiedFromTaskId | string \| null | |
| createdAt, updatedAt | Date | set by the client; `updatedAt` drives last-write-wins |
| serverUpdatedAt | Date | set by the server on every write; drives `GET /sync/pull` |
| deletedAt | Date \| null | tombstone |

Indexes: `{ userId:1, taskDate:1, orderIndex:1 }`, `{ userId:1, updatedAt:1 }`, `{ userId:1, serverUpdatedAt:1 }`. Tasks, notes and uploads use no Mongoose `timestamps` option (the client owns `createdAt`/`updatedAt`).

## notes

Reminder compatibility requires no destructive migration: existing missing values
read as null; an omitted field in an older client's upsert preserves the stored
value, while explicit null clears it. Copy-to-today does not copy a reminder.
| Field | Type | Notes |
|---|---|---|
| _id | string (uuid) | |
| userId | string | indexed |
| title | string | default "Untitled note" |
| descriptionHtml / descriptionText | string | as tasks |
| orderIndex | number | per user |
| createdAt, updatedAt | Date | client-owned, LWW key |
| serverUpdatedAt | Date | server-owned, pull key |
| deletedAt | Date \| null | |

Indexes: `{ userId:1, orderIndex:1 }`, `{ userId:1, updatedAt:1 }`, `{ userId:1, serverUpdatedAt:1 }`.

## uploads
`{ _id, userId, filename, mime, size, width, height, createdAt }`. Files live at `/app/uploads/<userId>/<uuid>.webp` (GIFs kept as-is). Index `{ userId:1 }`.

## Tombstone rules
Deletes set `deletedAt` and bump `updatedAt` (the server also bumps `serverUpdatedAt`). Pull returns tombstones. A purge removes tombstones older than 30 days. Last-write-wins compares `updatedAt` (deletes included).

## Client (Dexie) — database `dayflow_<userId>`
```ts
tasks:          "id, userId, taskDate, [userId+taskDate], orderIndex, updatedAt, deletedAt"
notes:          "id, userId, orderIndex, updatedAt, deletedAt"
outbox:         "++seq, entity, entityId, op, createdAt"
pendingUploads: "localId, entity, entityId, createdAt"
meta:           "key"   // lastPulledAt, lastSyncedAt, draft:task:<id|new>
```
The session (JWT + cached user profile) lives in a separate app-level database `dayflow_app` → `meta` key `session`, because it must be readable before the user id is known. The outbox holds only `(entity, entityId, op)`; the document itself is read from `tasks`/`notes` at push time, so several edits of one document coalesce into one change.

## Android SQLite — `dayflow_<userId>.sqlite`, version 1

The project-owned Kotlin repository shares one transaction layer between React
Native, widget, overlay and reminder actions. Each account has a separate database
and private image directory. Tables: `docs(entity,id,json,seen)`,
`outbox(seq,entity,id,stamp)`, `meta(key,value)`, `uploads(id,json)`,
`delivered(key)`. Document writes and outbox insertion commit atomically; acks
delete only sequence numbers included in the sent batch. Future versions require
explicit non-destructive migrations; unsupported upgrades fail without dropping data.

`meta` stores sync cursors, drafts, recoverable conflicts and appearance. Sessions
remain in Android-backed SecureStore, outside SQLite/editor HTML. After 30 days
without sync, a full snapshot is reconciled before pushing. Missing previously
synced documents are removed locally, retaining pending edits as recovery copies;
never-uploaded new documents remain queued. See [Android guide](ANDROID.md).
