/**
 * Markdown guide served at GET /api/agent/docs for AI agents using a personal API key.
 * Keep it in sync with the real routes (see docs/AGENT_API.md). Backticks are escaped for the template literal.
 */
export const AGENT_DOCS: string = `# Dayflow API guide for AI agents

Base URL: \`https://task-web-app.silverjeanscloth.com\`
Every API path below is relative to it. Responses are JSON unless stated.

## 1. What Dayflow is

Dayflow is a task and notes app with two kinds of data:

- **Personal data** (private to the key owner): daily **tasks** (one plan per calendar day), **notes**, and personal **images**.
- **Team data** (shared with every active member of a private team): **teams**, **projects** (one per client), **team tasks** with a work status and delivery tracking, a per-task **timeline** of events, task **messages** (chat) and team **images**.

The web, Windows and Android apps are offline-first: they keep a local copy and sync it. **The API is the source of truth.** Always read from the API before answering; do not rely on anything you read earlier if time has passed.

You act through a personal API key (\`dfk_...\`). A key acts exactly as its owner: it sees the owner's personal data and the teams the owner belongs to. It has no admin powers and cannot call \`/api/keys\` or \`/api/auth/*\`. Uploaded images (\`/uploads/...\`) also accept the Bearer key.

## 2. Quick start

Send the key on every request:

\`\`\`
Authorization: Bearer dfk_xxxxxxxx
\`\`\`

Step 1: call \`GET /api/agent/me\`.

\`\`\`json
{ "user": { "id": "u-uuid", "email": "a@b.com", "name": "Alex" },
  "auth": { "type": "api_key", "keyName": "My agent", "mode": "read" },
  "serverTime": "2026-11-22T09:30:00.000Z" }
\`\`\`

- \`auth.mode = "read"\`: the key is read-only. Every non-GET request returns **403 \`KEY_READ_ONLY\`**.
- \`auth.mode = "write"\`: the owner enabled **Allow changes**. Writes are possible, but still follow the rules below. The owner can flip this at any time (profile menu > API keys) and it takes effect immediately, so a later write can still get \`KEY_READ_ONLY\`.
- Remember \`user.id\` (needed for personal image URLs) and \`serverTime\` (the real "now"). "Today" for dates is the Asia/Dhaka calendar day of \`serverTime\`.

What to do on errors:

- **401 \`UNAUTHORIZED\`**: the key is wrong, rotated or deleted. Stop and tell the user to create or copy a key in the app (profile menu > API keys).
- **403 \`KEY_READ_ONLY\`**: tell the user: "This key is read-only. To let me make changes, turn on Allow changes for this key in the app (profile menu > API keys). It takes effect immediately." Then wait. Do not retry.
- **403 \`KEY_NOT_ALLOWED\`**: this key may not call that endpoint (for example \`/api/keys\` or \`/api/auth/*\`). Do not try again.
- **403 \`TEAM_ACCESS\`**: the owner is not (or no longer) a member of that team.

## 3. RULES FOR AGENTS (read these first)

1. **Reading is free.** Use GET requests whenever they help. Do not ask permission to read.
2. **Ask before ANY write** (POST, PATCH, PUT, DELETE). Before the call, tell the user in plain words:
   - exactly what will change (fields, old value to new value),
   - which task, project and team (by title/name, not only id),
   - the side effects: status or delivery changes recorded in the task timeline, live updates pushed to every teammate, edits visible to the whole team, messages teammates will read, files stored,
   - then **wait for an explicit "yes"**. A vague earlier instruction is not a yes for a specific change.
3. **Never write when \`auth.mode\` is \`read\`.** Ask the user to turn on Allow changes instead.
4. **Extra confirmation for destructive or bulk actions**: deleting/removing a task, note, project or team, removing a member, delivering or un-delivering several tasks, or changing more than a few items. List every affected item and ask a separate, explicit confirmation. Prefer not to delete teams or remove members at all; send the user to the app.
5. **Never reveal the key.** Do not print it, log it, put it in a URL, a task, a note or a message. Send it only in the \`Authorization\` header to the base URL above.
6. **Never invent ids.** Look up teams, projects, tasks, members and images with GET requests first and use the exact ids returned. (Exception: new personal task/note ids and chat message ids are client-generated; generate a fresh UUID v4.)
7. **Respect conflicts.** If a write returns **409 \`TASK_CONFLICT\`**, someone changed the task first. Do not retry blindly or overwrite. Re-read the task (the error includes the current task in \`details.task\`), show the user what changed, and ask again.
8. Send only the fields you mean to change. Do not silently change other fields.
9. After a write, re-read the item and tell the user the result.

Sentence pattern before a write:

> I'm about to **<action>** on **<item>** in **<team/project, or "your personal tasks">**: <old value> -> <new value>. This will <side effects, e.g. "be recorded in the task timeline and shown live to your teammates">. Shall I go ahead? (yes/no)

## 4. Data model

Conventions:
- ISO timestamps (\`2026-11-22T09:30:00.000Z\`) are UTC.
- Day fields (\`taskDate\`, \`clientDate\`, \`plannedDeliveryDate\`, \`copiedFromDate\`) are \`YYYY-MM-DD\` calendar days in **Asia/Dhaka** (UTC+6). Compare them as strings.
- \`descriptionHtml\` is sanitized rich-text HTML (paragraphs, lists, headings, code, \`<table>\`, images). \`descriptionText\` is the server-computed plain text (for search and previews; may be shortened). When writing, send \`descriptionHtml\` only.
- Images appear inside HTML as \`<img src="/uploads/...">\`: personal \`/uploads/<userId>/<uuid>.webp|gif\`, team \`/uploads/teams/<teamId>/<uuid>.webp|gif\`. Download them with the Bearer key (section 9).
- Ids are UUIDs.

Relationships:

\`\`\`
User --owns--> Task (personal, grouped by taskDate), Note, Upload (image)
User --member of--> Team --has--> TeamMember (users)
                         |--has--> TeamProject (a client) <--0..1-- TeamTask
                         |--has--> TeamTask --has--> TaskEvent (timeline), TeamMessage (chat)
                         |--has--> TeamUpload (image, with an ImageVersion chain)
\`\`\`

### Task (personal)

| Field | Type | Required on write | Allowed / meaning |
| --- | --- | --- | --- |
| id | uuid | yes | client-generated for new tasks |
| taskDate | YYYY-MM-DD | yes | the day the task is planned for; valid date, not later than Dhaka today + 1 day |
| title | string | yes | 1-200 chars (trimmed) |
| descriptionHtml | string | yes (may be "") | max 2,000,000 chars |
| descriptionText | string | no | ignored; recomputed by the server |
| estimatedMinutes | integer | yes | 0-1439 |
| reminderAt | ISO or null | no | omitted = keep stored value; null = clear |
| status | enum | yes | \`notStarted\`, \`started\`, \`completed\` |
| orderIndex | number | yes | sort key within the day (ascending); new tasks usually last + 1024 |
| copiedFromDate, copiedFromTaskId | string or null | yes (null if none) | set when copied from another day |
| createdAt, updatedAt | ISO | yes | \`updatedAt\` drives last-write-wins |
| deletedAt | ISO or null | yes | non-null = deleted (tombstone) |

### Note (personal)

| Field | Type | Required on write | Meaning |
| --- | --- | --- | --- |
| id | uuid | yes | client-generated |
| title | string | no | max 300; default "Untitled note" |
| descriptionHtml | string | no | max 2,000,000; default "" |
| descriptionText | string | no | recomputed by server |
| orderIndex | number | yes | sort key |
| createdAt, updatedAt | ISO | yes | |
| deletedAt | ISO or null | no | tombstone |

There are no labels or tags in Dayflow.

### Team

\`{ id, name, creatorId, createdAt, members: TeamMember[], openTaskCount }\`. The detail response adds \`projects: TeamProject[]\`, \`invites[]\`, \`people: TeamPerson[]\`.

- \`openTaskCount\`: board tasks that are not Done.
- Only the creator (\`creatorId\`) can delete the team or remove another member.

### TeamMember / TeamPerson

\`TeamPerson = { id, name, email }\`; \`TeamMember = TeamPerson + joinedAt\`. \`people\` also includes former members so old ids resolve to names.

### TeamProject (a client)

| Field | Type | Meaning |
| --- | --- | --- |
| id, teamId | uuid | |
| name | string 1-100 | unique per team among active projects (case-insensitive) |
| createdBy | user id | |
| createdAt | ISO | |
| archivedAt | ISO or null | non-null = archived: hidden from pickers, tasks keep their label, new tasks cannot use it |

### TeamTask

| Field | Type | Required on create | Allowed / meaning |
| --- | --- | --- | --- |
| id, teamId | uuid | no (server) | |
| title | string | yes | 1-200 |
| descriptionHtml | string | yes | max 2,000,000; \`<img>\` must point to this team's uploads or the call fails with \`TEAM_IMAGE\` |
| descriptionText | string | no | read-only |
| status | enum | yes | \`todo\` (To do), \`in_progress\` (In progress), \`completed\` (Done) |
| assigneeId | uuid or null | yes (may be null) | must be a current team member (\`INVALID_ASSIGNEE\`) |
| projectId | uuid or null | no | must be an active project of this team (\`INVALID_PROJECT\`) |
| clientDate | YYYY-MM-DD or null | no | day the client sent/asked for the task |
| plannedDeliveryDate | YYYY-MM-DD or null | no | must not be before \`clientDate\` (\`INVALID_DATES\`) |
| orderIndex | number | PATCH only | board order |
| createdBy | user id | read-only | |
| startedAt | ISO or null | read-only | set on In progress; cleared on To do |
| completedAt, completedBy | ISO/null, user id/null | read-only | set when moved to Done |
| statusChangedAt | ISO | read-only | last status change |
| deliveredAt, deliveredBy | ISO/null, user id/null | read-only | set by the deliver call |
| archivedAt | ISO or null | read-only | set automatically 24h after delivery (task is then in History) |
| removedAt, removedBy | ISO/null, user id/null | read-only | non-null = removed (History > Removed) |
| createdAt, updatedAt | ISO | read-only | |
| version | integer >= 1 | read-only | optimistic-lock counter; send it back on every PATCH/delete/restore/deliver/undeliver |
| messageCount | integer | read-only | chat messages on the task |
| unread | boolean | read-only | newer messages from others than the owner's read position |

Derived concepts (compute them yourself; the API has no such filters):
- **Done vs Delivered**: \`status = "completed"\` means the work is done. **Delivered** means it was handed to the client (\`deliveredAt != null\`). A Done task that is not delivered is **Awaiting delivery**.
- **Overdue**: \`plannedDeliveryDate\` is set, earlier than today (Dhaka) and \`deliveredAt\` is null, whatever the work status. No planned date = never overdue.
- **Board vs History**: \`GET /api/teams/:teamId/tasks\` is the board (not removed, not archived). A task moves to **History** 24 hours after it is delivered, or when removed. Undelivered Done tasks are never auto-archived.
- Moving a task out of Done clears delivery (an \`undelivered\` timeline event is recorded). Restoring a task resets it to \`todo\`.

### TaskEvent (team task timeline)

\`{ id, actorId, type, from, to, at }\`

\`type\`: \`created\`, \`status_changed\` (from/to = status), \`assigned\` (from/to = user ids or null), \`edited\`, \`removed\`, \`restored\`, \`archived\` (actorId null, automatic), \`delivered\`, \`undelivered\`.

### TeamMessage (task chat)

\`{ id, taskId, authorId, bodyText, bodyHtml, createdAt }\`

### Upload / image

Personal URL \`/uploads/<userId>/<uuid>.webp|gif\`; team URL \`/uploads/teams/<teamId>/<uuid>.webp|gif\`. Upload result \`{ url, width, height }\`. Images are re-encoded to WebP (max width 1600); GIFs are kept as is.

### ImageVersion

\`{ url, width, height, createdAt }\` newest first (team versions only have \`url\` and \`createdAt\`). Marking up an image creates a new file and keeps the previous one hidden from descriptions; chains are capped at 25 entries.

## 5. "I want to ... -> call this"

| Goal | Call |
| --- | --- |
| Who am I, is the key read-only? | \`GET /api/agent/me\` |
| My personal tasks for one day | \`GET /api/tasks?date=YYYY-MM-DD\` |
| Which days in a month have personal tasks | \`GET /api/tasks/dates?month=YYYY-MM\` |
| Personal tasks in a range / overdue / by status / text | \`GET /api/agent/tasks?from=&to=&status=&overdue=true&q=&updatedSince=\` (server-side filters, see below). Personal tasks have a plan day, not a due date; "overdue" = \`taskDate\` before today and not completed |
| Personal changes since a time | \`GET /api/sync/pull?since=<ISO>\` (tasks and notes changed on the server after that time, including deleted ones) |
| Search / list my notes | \`GET /api/agent/notes?q=&updatedSince=\` |
| Which teams am I in | \`GET /api/teams\` |
| Team members and projects | \`GET /api/teams/:teamId\` |
| Tasks in a team (the board) | \`GET /api/teams/:teamId/tasks\`, filter client-side |
| Tasks in project X | board list, filter \`projectId === X\` (also History if finished work is wanted) |
| Awaiting delivery | board list, filter \`status === "completed" && deliveredAt === null\`, sort by \`plannedDeliveryDate\` |
| Overdue | board list, filter \`plannedDeliveryDate < today && deliveredAt === null\` |
| Due this week | board list, filter \`plannedDeliveryDate\` within the week and \`deliveredAt === null\` |
| My team tasks across all teams | \`GET /api/teams\`, then each team's board, filter \`assigneeId === user.id\` |
| Latest changes in a team since a time | board list, filter \`updatedAt > time\` (a new chat message does not change \`updatedAt\`; check \`messageCount\`/\`unread\`) |
| One task, current version | \`GET /api/teams/:teamId/tasks/:taskId\` |
| Task timeline / who changed what | \`GET /api/teams/:teamId/tasks/:taskId/events\` |
| Team activity timeline | there is no team-wide feed: list the board, then call \`/events\` for tasks of interest |
| Delivered/finished or removed tasks | \`GET /api/teams/:teamId/history?kind=completed\` or \`kind=removed\`, optional \`q\`, \`page\` |
| Task chat | \`GET /api/teams/:teamId/tasks/:taskId/messages[?before=<messageId>]\` |
| Images in a task or note | parse \`descriptionHtml\` for \`src="(/uploads/[^"]+)"\`, then GET each URL |
| Versions of an image | personal: \`GET /api/uploads/:userId/:file/versions\`; team: \`GET /api/teams/:teamId/uploads/:file/versions\` |
| My pending team invitations | \`GET /api/teams/invites\` |
| Live "something changed" signal | \`GET /api/sync/events\` (SSE), then re-read |

## 6. Reading endpoints

All need the Bearer key. Team routes need the owner to be an active member (else 403 \`TEAM_ACCESS\`). Ids in team paths must be UUIDs (else 400 \`VALIDATION_ERROR\`). Team responses are \`Cache-Control: private, no-store\`.

### GET /api/agent/me
See section 2.

### GET /api/tasks?date=YYYY-MM-DD
Query: \`date\` (required, \`YYYY-MM-DD\`). Response \`{ "tasks": [Task] }\`: that day's non-deleted personal tasks ordered by \`orderIndex\`.

\`\`\`json
{ "tasks": [ { "id": "…", "taskDate": "2026-11-22", "title": "Write report", "descriptionHtml": "<p>…</p>",
  "descriptionText": "…", "estimatedMinutes": 90, "reminderAt": null, "status": "started",
  "orderIndex": 1024, "copiedFromDate": null, "copiedFromTaskId": null,
  "createdAt": "…", "updatedAt": "…", "deletedAt": null } ] }
\`\`\`

### GET /api/tasks/dates?month=YYYY-MM
Query: \`month\` (required, \`YYYY-MM\`). Response \`{ "dates": ["2026-11-03", "2026-11-22"] }\`, days with at least one non-deleted personal task.

### GET /api/agent/tasks (personal tasks, filtered)
Query, all optional: \`from\` and \`to\` (\`YYYY-MM-DD\`, inclusive range on \`taskDate\`), \`status\` (\`notStarted|started|completed\`), \`overdue=true\` (taskDate before today in Dhaka, not completed), \`q\` (case-insensitive text in title and description), \`updatedSince\` (ISO time). Deleted tasks are never returned. Max 500, ordered by \`taskDate\` then order. Response \`{ "tasks": [Task], "today": "YYYY-MM-DD" }\`.

### GET /api/agent/notes (personal notes, filtered)
Query, all optional: \`q\`, \`updatedSince\`. Response \`{ "notes": [Note] }\` (max 500).

### GET /api/notes
Response \`{ "notes": [Note] }\` non-deleted, ordered by \`orderIndex\`. Not paginated.

### GET /api/sync/pull?since=ISO
Query: \`since\` optional ISO timestamp. Response \`{ "tasks": [Task], "notes": [Note], "serverTime": "ISO" }\`. Without \`since\` it returns everything, including deleted items (\`deletedAt != null\`; skip them). Use the returned \`serverTime\` as the next \`since\`. The simplest way to read all personal data in one call. Personal data only (no team data).

### GET /api/sync/events
Server-sent events stream. \`event: change\` with \`data: {}\` means "something changed, re-read"; it carries no data. Team changes (tasks, projects, chat, membership) also trigger it for every member. A heartbeat comment arrives every 20 s. Only useful for long-running agents; short sessions can skip it.

### GET /api/teams
\`{ "teams": [ { "id", "name", "creatorId", "createdAt", "members": [{ "id", "name", "email", "joinedAt" }], "openTaskCount": 4 } ] }\`

### GET /api/teams/:teamId
\`{ "team": { …summary, "projects": [TeamProject], "invites": [...], "people": [TeamPerson] } }\`

### GET /api/teams/invites
\`{ "invites": [ { "id", "teamId", "teamName", "invitedUserId", "invitedBy": {…}, "invitedUser": {…}, "createdAt" } ] }\`: pending invitations for the owner.

### GET /api/teams/:teamId/tasks
\`{ "tasks": [TeamTask] }\`: the board (not removed, not archived), ordered by \`orderIndex\`, descriptions included. Each call also moves eligible delivered tasks to History.

\`\`\`json
{ "id": "…", "teamId": "…", "title": "Landing page", "descriptionHtml": "<p>…</p>", "status": "completed",
  "assigneeId": "u1", "projectId": "p1", "clientDate": "2026-11-10", "plannedDeliveryDate": "2026-11-20",
  "deliveredAt": null, "deliveredBy": null, "version": 7, "messageCount": 3, "unread": false,
  "createdAt": "…", "updatedAt": "…", "archivedAt": null, "removedAt": null }
\`\`\`

### GET /api/teams/:teamId/tasks/:taskId
\`{ "task": TeamTask }\`. Works for removed/archived tasks too.

### GET /api/teams/:teamId/history
Query: \`kind\` = \`completed\` (default; delivered then archived) or \`removed\`; \`q\` string up to 200 chars (case-insensitive title substring); \`page\` integer >= 0 (default 0, 50 per page).
Response \`{ "tasks": [TeamTask], "hasMore": boolean, "people": [TeamPerson] }\`.

### GET /api/teams/:teamId/tasks/:taskId/events
\`{ "events": [TaskEvent], "people": [TeamPerson] }\`, oldest first.

### GET /api/teams/:teamId/tasks/:taskId/messages
Query: \`before\` optional message uuid (returns older ones). Response \`{ "messages": [TeamMessage], "people": [TeamPerson], "hasMore": boolean }\`, up to 50 per page in chronological order. Page backwards by passing the first message id as \`before\`.

### Image reads
See section 9.

## 7. Writing endpoints (WRITE: need Allow changes)

Every WRITE call needs \`auth.mode = "write"\` (otherwise 403 \`KEY_READ_ONLY\`), JSON bodies (\`Content-Type: application/json\`, max 5 MB) except uploads, and the confirmation described in section 3.

### Personal tasks and notes

Personal tasks and notes are written through the sync endpoint, the only write path the apps use. It is built for offline clients but works for single changes.

#### WRITE POST /api/sync/push
Body: \`{ "changes": [ { "entity": "task"|"note", "op": "upsert"|"delete", "doc": { full document }, "clientUpdatedAt": "ISO (optional)" } ] }\`, at most 100 changes.

- \`doc\` is the **full** Task or Note (section 4). To edit: read the current document, change the fields you mean to change, set \`updatedAt\` to the current time (it must be strictly newer than the stored \`updatedAt\`, otherwise your change loses and \`applied\` is false), and send the whole document.
- New item: generate a UUID v4 \`id\`, set \`createdAt\` and \`updatedAt\` to now, \`deletedAt: null\`.
- Delete: \`op: "delete"\` with \`deletedAt\` set (a soft delete). Needs the extra confirmation of rule 4.
- Response \`{ "results": [ { "entity", "id", "applied": true|false, "winner": {…}|null, "error"?: "FORBIDDEN" } ], "serverTime": "ISO" }\`, in request order. \`applied:false\` with a \`winner\` means the server copy is newer or equal: re-read and ask the user. \`FORBIDDEN\` means that id belongs to another user.
- Side effects: the user's other devices refresh live; HTML is sanitized; \`descriptionText\` is recomputed.
- If the stored description contains a \`<table>\` and your change would alter that description, send header \`X-Dayflow-Rich-Content: tables-v1\` and keep the table HTML intact; otherwise the server answers 409 \`EDITOR_UPDATE_REQUIRED\` and keeps its copy. Only send the header if you really preserve tables.
- Errors: 400 \`VALIDATION_ERROR\` (bad field, \`taskDate\` too far in the future), 409 \`EDITOR_UPDATE_REQUIRED\`.

Say: "I'm about to create the task 'X' on 2026-11-23 in your personal tasks (status notStarted, 30 min). It syncs to all your devices. Shall I go ahead?"

#### WRITE POST /api/tasks/:id/copy-to-today
Copies a personal task to today's list (Dhaka date) as a new \`notStarted\` task at the end, without a reminder. 201 \`{ "task": Task }\`. 404 \`NOT_FOUND\` if missing or deleted.

### Team projects

#### WRITE POST /api/teams/:teamId/projects
Body \`{ "name": string 1-100 }\`. 201 \`{ "project": TeamProject }\`. 409 \`PROJECT_EXISTS\` for a duplicate active name. Every member sees the new project. Limit 30/min.

#### WRITE PATCH /api/teams/:teamId/projects/:projectId
Body (all optional): \`{ "name": string 1-100, "archived": boolean }\`. Response \`{ "project": TeamProject }\`. Archiving hides the project from pickers but keeps its tasks; \`archived:false\` restores it (name must be unique). 404 \`NOT_FOUND\`, 409 \`PROJECT_EXISTS\`. Visible to all members. Limit 60/min.

### Team tasks

#### WRITE POST /api/teams/:teamId/tasks
Body: \`title\` (required, 1-200), \`descriptionHtml\` (required, may be ""), \`status\` (required: \`todo\`|\`in_progress\`|\`completed\`), \`assigneeId\` (required: member uuid or \`null\`), optional \`projectId\` (active project uuid or null), \`clientDate\`, \`plannedDeliveryDate\` (\`YYYY-MM-DD\` or null). 201 \`{ "task": TeamTask }\` with \`version\` 1.
Side effects: a \`created\` timeline event; all members get a live update; the task goes last on the board; creating directly as \`completed\` records completion time and person.
Errors: 400 \`INVALID_ASSIGNEE\`, \`INVALID_PROJECT\`, \`INVALID_DATES\`, \`TEAM_IMAGE\`, \`VALIDATION_ERROR\`. Limit 60/min.

#### WRITE PATCH /api/teams/:teamId/tasks/:taskId
Body: **\`version\` (required integer >= 1, the task's current version)** plus any of \`title\`, \`descriptionHtml\`, \`status\`, \`assigneeId\`, \`projectId\`, \`clientDate\`, \`plannedDeliveryDate\`, \`orderIndex\` (number). Send only changed fields.
Response \`{ "task": TeamTask }\` with \`version + 1\` (the unchanged task if nothing really changed).
Side effects, recorded in the timeline and shown live to every member: \`status_changed\` (leaving Done also clears delivery and records \`undelivered\`; entering Done records who/when), \`assigned\`, \`edited\` (title, description, project or dates changed).
Errors: 409 \`TASK_CONFLICT\` (stale \`version\`; \`details.task\` is the current task), 409 \`TASK_HISTORY\` (task is removed/archived: restore first), 409 \`EDITOR_UPDATE_REQUIRED\` (table; see the header above), 400 \`INVALID_ASSIGNEE\`/\`INVALID_PROJECT\`/\`INVALID_DATES\`/\`TEAM_IMAGE\`, 404 \`NOT_FOUND\`. Limit 180/min.

#### WRITE POST /api/teams/:teamId/tasks/:taskId/deliver
Body \`{ "version": integer }\`. Marks a **Done** task as delivered to the client (\`deliveredAt\`, \`deliveredBy\` = key owner); it moves to History 24 hours later. Response \`{ "task": TeamTask }\`. Errors: 409 \`TASK_NOT_DONE\` (status is not \`completed\`), 409 \`TASK_HISTORY\`, 409 \`TASK_CONFLICT\`. Records a \`delivered\` event; notifies all members. Limit 120/min.

Say: "I'm about to mark 'Landing page' (project Acme, team Studio) as delivered to the client. This is recorded in the task timeline with your name and shown live to your teammates; it moves to History after 24 hours. Shall I go ahead?"

#### WRITE POST /api/teams/:teamId/tasks/:taskId/undeliver
Body \`{ "version": integer }\`. Clears delivery and records \`undelivered\`. Same errors as deliver except \`TASK_NOT_DONE\`. Limit 120/min.

#### WRITE DELETE /api/teams/:teamId/tasks/:taskId
Body \`{ "version": integer }\` (a DELETE with a JSON body). Moves the task to History > Removed (reversible). Response \`{ "ok": true }\`. 409 \`TASK_CONFLICT\`. Records \`removed\`. Needs the extra confirmation of rule 4.

#### WRITE POST /api/teams/:teamId/tasks/:taskId/restore
Body \`{ "version": integer }\`. Brings a removed or archived task back to the board as \`todo\`, with delivery and completion cleared. Response \`{ "task": TeamTask }\`. Records \`restored\`.

### Team chat

#### WRITE POST /api/teams/:teamId/tasks/:taskId/messages
Body \`{ "id": uuid (new, client-generated), "bodyText": string max 10000, "bodyHtml": string max 100000 }\`; needs text or an image. 201 \`{ "ok": true }\`. Every member can read the message and gets a live update. Re-sending the same \`id\` by the same author is a no-op; an id used by someone else gives 409 \`MESSAGE_ID\`. Errors: 400 \`EMPTY_MESSAGE\`, \`TEAM_IMAGE\`; 409 \`TASK_HISTORY\`. Limit 30/min.

#### WRITE POST /api/teams/:teamId/tasks/:taskId/read
Body \`{ "messageId": uuid }\`. Moves the owner's read position (only the owner's \`unread\` flag). 404 \`NOT_FOUND\`. Do this only if the user asked.

### Team and membership (high impact; prefer sending the user to the app)

| Call | Body | Notes |
| --- | --- | --- |
| WRITE \`POST /api/teams\` | \`{ name 1-100, projectName? 1-100 }\` | creates a team owned by the user; 201 \`{ team }\`; 10/min |
| WRITE \`POST /api/teams/:teamId/invites\` | \`{ email }\` | invites an existing Dayflow account; 404 \`NO_ACCOUNT\`, 409 \`ALREADY_MEMBER\` or \`INVITE_PENDING\`, 429 \`INVITE_COOLDOWN\`; 5/min; the person is notified |
| WRITE \`DELETE /api/teams/:teamId/invites/:inviteId\` | none | cancels a pending invitation |
| WRITE \`POST /api/teams/invites/:inviteId/accept\` or \`/decline\` | none | answers an invitation from \`GET /api/teams/invites\` (use its \`id\`) |
| WRITE \`POST /api/teams/:teamId/leave\` | none | the owner leaves the team; the creator cannot (\`CREATOR_CANNOT_LEAVE\`) |
| WRITE \`DELETE /api/teams/:teamId/members/:userId\` | none | creator only (\`CREATOR_ONLY\`) |
| WRITE \`DELETE /api/teams/:teamId\` | \`{ "name": exact team name }\` | creator only; **permanently deletes** tasks, chat, history and images; \`NAME_MISMATCH\` |

## 8. Errors

Envelope: an HTTP status plus

\`\`\`json
{ "error": { "code": "TASK_CONFLICT", "message": "Someone updated this task. Review their changes." }, "details": { "task": {} } }
\`\`\`

\`details\` exists only for some errors (\`TASK_CONFLICT\`). Branch on \`error.code\`.

| Status | Code | Meaning / what to do |
| --- | --- | --- |
| 400 | VALIDATION_ERROR | body/query/path failed validation; the message lists \`field: problem\`. Fix and ask again |
| 400 | BAD_JSON | malformed JSON |
| 400 | INVALID_ASSIGNEE, INVALID_PROJECT, INVALID_DATES, TEAM_IMAGE, EMPTY_MESSAGE, INVALID_CURSOR, NAME_MISMATCH, INVALID_ID | team input problems (see endpoints) |
| 400 | NO_FILE, INVALID_IMAGE, INVALID_REPLACES, UPLOAD_ERROR | upload problems |
| 401 | UNAUTHORIZED | missing, wrong, rotated or deleted key |
| 403 | KEY_READ_ONLY | key is read-only; ask the user to enable Allow changes |
| 403 | KEY_NOT_ALLOWED | key may not call this endpoint |
| 403 | TEAM_ACCESS | not an active member of that team |
| 403 | CREATOR_ONLY | only the team creator can do this |
| 403 | FORBIDDEN | e.g. another user's personal image |
| 404 | NOT_FOUND | missing item or route |
| 409 | TASK_CONFLICT | stale \`version\`; \`details.task\` is the current task. Re-read, show, ask |
| 409 | TASK_HISTORY | task is removed/archived; restore first |
| 409 | TASK_NOT_DONE | deliver needs status \`completed\` |
| 409 | EDITOR_UPDATE_REQUIRED | would flatten a table; send \`X-Dayflow-Rich-Content: tables-v1\` and keep the table |
| 409 | PROJECT_EXISTS, ALREADY_MEMBER, INVITE_PENDING, MESSAGE_ID | duplicates |
| 413 | FILE_TOO_LARGE | upload too big (default 10 MB) |
| 429 | RATE_LIMIT, RATE_LIMITED, INVITE_COOLDOWN | slow down; wait a minute |
| 500 | INTERNAL | server error; retry once later, then tell the user |

## 9. Images

- **Download**: \`GET <base><src>\` with the Bearer key, where \`<src>\` is the path from \`<img src>\` (for example \`/uploads/<userId>/<uuid>.webp\` or \`/uploads/teams/<teamId>/<uuid>.webp\`). The response is the image bytes (WebP or GIF). Personal images are readable only by their owner (the user id in the path must equal \`user.id\`, else 403 \`FORBIDDEN\`); team images need team membership (else 403 \`TEAM_ACCESS\`; 404 if missing). File names always look like \`<uuid>.webp\` or \`.gif\`. Never put the key in the URL.
- **Versions**: \`GET /api/uploads/:userId/:file/versions\` (personal, owner only) returns \`{ "versions": [ { "url", "width", "height", "createdAt" } ] }\`; \`GET /api/teams/:teamId/uploads/:file/versions\` returns \`{ "versions": [ { "url", "createdAt" } ] }\`. \`:file\` is the file name (\`<uuid>.webp\`) from the URL. Newest first, max 25. Older versions are hidden from descriptions but can be downloaded from their \`url\`.
- **Upload (WRITE)**: \`POST /api/uploads\` (personal) or \`POST /api/teams/:teamId/uploads\` (team), \`multipart/form-data\` with one file field named \`file\` (png, jpg, webp or gif; default max 10 MB). Optional text field \`replaces\` = file name of an earlier image you are editing (must already exist; the old one is kept as a hidden version). 201 \`{ "url": "/uploads/...", "width": n, "height": n }\`. Team upload limit 15/min.
  - An upload alone shows nowhere. To use it, put \`<img src="<url>">\` into a description (a separate WRITE). Team descriptions may only reference uploads of the same team.
  - Say first: "I'll upload this image to <your personal files | team T>. Team uploads are visible to all members once placed in a task."

## 10. Limits and gotchas

- JSON body max **5 MB**; uploads max 10 MB by default; description HTML max 2,000,000 chars; sync push max 100 changes.
- Per-user, per-minute rate limits on team writes: create team 10, projects 30, project patch 60, invites 5, create task 60, patch task 180, deliver/undeliver 120, messages 30, uploads 15. Exceeding returns 429.
- **Prefer the REST endpoints** for team data. The sync endpoints (\`/api/sync/*\`) are an offline-sync protocol (last-write-wins by \`updatedAt\`, tombstones, full documents). Use them for personal tasks and notes only, where no simpler write endpoint exists.
- Personal tasks cannot be planned later than Dhaka today + 1 day.
- Team \`version\` is mandatory on PATCH, delete, restore, deliver and undeliver; re-read just before writing.
- Pagination exists only for History (50 per page, \`page\`) and messages (50, \`before\`). The board, \`/api/notes\` and \`/api/sync/pull\` are not paginated.
- No server-side search or date filtering except History \`q\`; filter client-side as shown in section 5.
- "Today" is the Asia/Dhaka date, not UTC; derive it from \`serverTime\`.
- Deleted/removed items are soft-deleted; personal tombstones are purged after 30 days.
- Keys never expire. If the owner rotates or deletes the key you get 401 and must stop.
`;
