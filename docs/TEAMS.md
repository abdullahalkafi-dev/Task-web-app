# Teams (web and backend)

Teams are private, invitation-only workspaces. Sign in once before someone can
invite your Google account email. Open **Teams**, create a named team, then open
**Members** to invite an existing Dayflow user. Recipients accept or decline on
their Teams page; a pending invitation grants no access.

## Membership and privacy

Every active member can create, edit, assign, complete, remove and restore tasks,
send task messages, invite users and cancel pending invitations. Only the creator
can remove another member or delete the team. The creator cannot leave;
ownership transfer and configurable roles are deferred. Team deletion requires
the exact name and permanently removes tasks, conversations, history and images.

Leaving or removal unassigns that person's tasks while preserving attribution.
Personal tasks, notes, uploads and offline sync are separate. Membership is
checked on every request, including images. Team APIs and images use `private, no-store`
and bypass the service worker cache. The mounted team's in-memory data is cleared
on the next denied request/live refresh. Previously viewed or downloaded content
cannot be erased remotely from a person's device.

## Projects (clients)

A team can have any number of **projects**; a project represents one client. Projects
are optional: a task has one project or none, and a team works fine with no projects.
When creating a team you may name a first project; any active member can add,
rename, archive or restore projects later from **Projects** in the team header.
Names are unique per team (case-insensitive) among active projects.

Archiving a project hides it from the project picker but keeps its tasks, their
project label and History unchanged. New tasks cannot be put in an archived project;
restoring it makes it selectable again. Team deletion removes projects with the team.

## Tasks, delivery and history

Team tasks have three work states: **To do**, **In progress**, **Done**. They do
not reset at midnight. Assign one current member or leave a task unassigned. The
creator is recorded automatically and never changes.

Finishing work and handing it to the client are different events, so **delivery is
tracked separately from status**. Each task has:

| Field | Meaning | Set by |
| --- | --- | --- |
| Project | Optional client project | Member |
| Client given date | Day the client gave us this work (date only, optional; the editor defaults it to today) | Member |
| Planned delivery date | Day promised to the client (date only, optional) | Member |
| Created at | When entered in the app | Automatic |
| Started at | First move to In progress | Automatic |
| Done at | Move to Done | Automatic |
| Status changed at | Latest status change | Automatic |
| Delivered at / by | When and who handed it to the client | **Mark delivered** |

Date-only fields are Bangladesh (Asia/Dhaka) calendar days stored as `YYYY-MM-DD`.
Planned delivery cannot be before the client given date. The old day estimate and
its due-day arithmetic are removed.

Example: a client gives six changes on 10 Nov (client date 10 Nov for all). Planned
delivery is 12 Nov for two, 14 Nov for two and 16 Nov for two. All six are finished
and marked Done on 11 Nov: they show **Awaiting delivery**, not delivered. On 12 Nov
the first two are marked delivered. A new change received on 13 Nov is a new task
with client date 13 Nov and its own planned delivery date.

**Mark delivered** is only available for Done tasks and records the time and person.
**Undo delivered** clears them. Moving a task out of Done, or restoring it from
History, also clears delivery. A task is **overdue** when it has a planned delivery
date earlier than today (Asia/Dhaka) and is not delivered, regardless of its work
status; with no planned date it is never overdue. Starting records `startedAt`;
completing/reopening preserve it; moving to To do clears it.

A Done task stays on the board until it is delivered; 24 hours after delivery it
moves to History. Undelivered Done tasks are never auto-archived. Hourly maintenance
and lazy board/history reads archive delivered tasks. History has Completed
(delivered) and Removed tabs, title search and pages of 50. Any member can restore a
historical task to To do. Removing a task retains its chat and records who removed it.

Task details show creator, client, start, done, planned and delivered dates in Asia/Dhaka. Chat and the append-only
timeline are collapsed by default. Chat accepts text/team images, pages of 50,
and a per-user read position. Cards add assignee, project, planned delivery/overdue and delivered labels and the message
count/unread dot to the existing controls.

## Team header and filters

A **Project** selector (All projects / each active project / No project) sits beside
the assignee filter. Next to the Board and List views are **Awaiting delivery**
(Done, not delivered, ordered by planned date) and **Overdue** views, both honoring
the project and assignee filters, plus History.

The team header uses a quiet Teams breadcrumb above the heading. The team-name
switcher appears only when there is more than one team. Team switching and the
Assignee filter share custom, theme-aware selection menus with a checkmark for
the current choice. The assignee filter shows the selected member's name and a
clear action; clearing returns keyboard focus to the filter. The filter and view
buttons use matching 40-pixel heights. The task editor's searchable assignee
picker remains available for assigning work.

## Online behavior and conflicts

Teams use REST and account-scoped SSE invalidation, focus/reconnect refresh and
a 30-second polling fallback. There is no team outbox or persistent offline
cache. Loaded data can remain read-only during a connection failure; mutations
require a connection. Personal offline behavior is unchanged.

PATCH, remove and restore requests carry the last observed task `version`.
HTTP 409 returns the latest task. The editor keeps unsent fields and offers
**Use latest** or **Keep my edits**, followed by an explicit save. Incoming
updates preserve the mounted editor and draft.

The API sends content-free invalidations to active members through the existing
user stream. Invite recipients get private hints; a departing user gets one final
access-change hint and no later team hints. Browser tabs share invalidations
with BroadcastChannel. No email, push or native notifications are added.

## Implementation and deployment boundaries

MongoDB is standalone and the API runs in one process. Timeline events are
**embedded in the task document**, appended atomically with each task change.
This deliberate refinement of the plan's separate event collection guarantees
change/history consistency without a replica-set migration. Events remain
available through their own endpoint. Related models live together in `team`,
with the repository's route/controller/service structure. Per-team in-process
queues serialize membership and task writes.

Before adding API workers, replace the queues with database coordination and the
notification bus with shared pub/sub. Preserve membership checks and task
versions. The optional offline cache, Android implementation, native
notifications, ownership transfer and configurable roles remain deferred.

Teams also load in the existing Electron full workspace, which uses the hosted
frontend. No Windows installer or Android release is built for this web release.
Compact desktop UX and real desktop interaction need their later acceptance check.

## Verification and operations

Run root `npm run check`, build frontend/backend, then the frontend Playwright
suite. Team tests use the throwaway stack and a test-only Mongo URI under ignored
`.next/` to age a completed task; production has no time-travel endpoint. Layout
tests capture both themes at 360/768/1024/1440/1920px and run axe.

Follow [deployment](../deploy/README.md). Back up database/uploads and retain the
previous revision before deployment. New collections/indexes are additive;
personal schemas and sync contracts are unchanged. Roll back code without
dropping/restoring data. Record actual evidence in [the audit log](AUDIT_LOG.md).
