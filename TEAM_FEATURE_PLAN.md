# Dayflow Teams — Feature Plan (Web + Backend first)

Status: **implemented for web/backend; release verification in progress.** See
`docs/TEAMS.md` for the implemented rules and `docs/AUDIT_LOG.md` for actual release evidence.
Desktop-specific acceptance and Android come after the web release.
All decisions below were agreed in conversation. Anything marked **Open** still needs a decision.

---

## 1. Goal

Let people work together on tasks without disturbing the personal task experience.

- A user creates a **team** and invites **existing Dayflow users** by email.
- The invited user **accepts or declines**. Nobody can join on their own.
- Members share a **team board**, assign tasks to each other, and talk inside each task.
- Personal tasks and notes are **never visible** to teammates.

Design rule for every decision: *personal Dayflow stays exactly as it is; Teams is one extra place you go to on purpose.*

---

## 2. Agreed rules

### Membership
| Rule | Decision |
|---|---|
| Who can join | Only via invitation from a member, accepted by the invitee |
| Invite target | Only people who **already have an account**. Unknown email → clear message "No Dayflow account with this email" |
| Who can invite | Any member |
| Who can remove a member | **Team creator only** |
| Leaving | Any member can leave. The creator **cannot** leave; the creator can only delete the team |
| Deleting the team | Creator only. Permanently deletes the team's tasks and images; confirmation requires typing the team name |
| Roles / permissions | **None for now.** Every member can do everything except remove members and delete the team |
| Size limits | No member or team count limits visible to users (invisible server safety limits only, see §9) |

### Tasks
| Rule | Decision |
|---|---|
| Who can create / edit / assign / complete / remove | Any member |
| Created by | Set automatically, never changes |
| Assigned to | One current member, or Unassigned. Any member can change it |
| Estimate | **In days** (whole numbers, no hours) |
| When estimate starts counting | When the task moves to **In progress** |
| Images | Supported, visible only to current team members |
| Board behavior | Tasks **do not reset at midnight**. They stay until a member removes them |
| Done tasks | Stay in the Done column for **24 hours**, then move to History automatically |
| Removed tasks | Go to History with who removed them and when. **Any member can restore** them |
| Member leaves / is removed | Their tasks stay with the team and become Unassigned |

### History
- One **History** tab inside the Teams area holds the full record: archived (completed) tasks and removed tasks.
- Each task keeps a small timeline: created, status changed, assigned, edited, removed, restored, with **who** and **when**.
- All times are shown in **Bangladesh time (Asia/Dhaka, UTC+6)**, consistent with the rest of Dayflow (`docs/ARCHITECTURE.md` §5).
- History is *not* shown on the board or cards. It appears inside task details and on the History tab only.

### Communication
- **Per-task chat**, inside the task dialog. No team-wide chat window.
- Text and images. Online only. No reactions, no message editing history in v1.
- A card shows only a small message count and an unread dot.

### Offline
- Team features are **online-first**.
- Optional, low priority: a read-only cache of the last-loaded team board. No offline editing in v1.
- Personal tasks keep working offline exactly as today.

### Explicitly out of scope for now
Roles and permissions, activity feed on the board, "My work across teams" view, push / email / desktop / Android notifications, team-wide chat, reactions, @mentions, ownership transfer.

---

## 3. User experience

### 3.1 Principle: keep the existing design language exactly

The app already has a strong visual system (`docs/ARCHITECTURE.md` §9 and `frontend/src/components/ui/`). Teams reuses it. It introduces **no new colors, gradients, fonts, or card styles.**

| Existing element | How Teams reuses it |
|---|---|
| Shell frame, rounded panels, 16–20px gaps | Teams pages render inside the same shell and panels |
| `IconRail` pill groups, active = black circle | One new rail item, same `NavLink` component, same active style |
| `BottomTabBar` (mobile web) | One new tab, same pattern |
| `TaskBoard` + three status columns | Team board **is the same board component** fed by team data |
| `TaskCard` | Same card, plus one small assignee chip (see §3.4) |
| `TaskEditorDialog` | Same dialog, plus one "Assigned to" field and a day estimate |
| `Dialog`, `ConfirmDialog`, `Menu`, `PillTabs`, `Avatar`, `Button`, `Toast`, `InfoBanner`, `ColumnHeader`, `StatusChip`, `Field` | Reused as-is. New UI is composed from these |
| Tokens (`--text-muted`, surfaces, shadows, light/dark) | Used unchanged. No new tokens needed |
| Typography and tight-tracking headings | Same scale as Home/History |

Rules that keep the UI simple:
1. **Quiet by default.** A user with no teams sees one extra icon and nothing else changes.
2. **Team name is the identity.** No team colors, banners, or logos.
3. **Add task stays the one dominant action.** Everything else (Members, History, Leave) is secondary styling and sits behind a labeled menu.
4. **Cards stay small.** Title, assignee, status, day estimate. Nothing else.
5. **Details live in the dialog,** not on the card: created by, timeline, chat.
6. **No new permanent panels.** No member sidebar, no activity column. The existing notes sidebar is not shown on the Teams screens.

### 3.2 Navigation
- Add **one** item "Teams" to the icon rail (middle group) and the mobile bottom bar.
- Use an icon that is clearly different from the admin "User management" icon (`Users` is already taken).
- A small numeric badge shows **pending invitations**. This is the only notification in v1.
- Route: `/teams`, with `/teams/[teamId]` and `/teams/[teamId]/history`.

### 3.3 Screens

**A. Teams home (`/teams`)**
- Greeting-style heading "Teams" (same large heading style as Home).
- If invitations are pending: one `InfoBanner`-style strip per invitation: "*Ayesha invited you to Design team*" with **Accept** / **Decline**.
- List of your teams as simple cards: team name, member avatars (max 4 + "+N"), open-task count.
- Primary button **New team** (name only).
- Empty state: one sentence plus the New team button.

**B. Team board (`/teams/[teamId]`)**
Header row (one line on desktop, wraps cleanly on mobile):
- Team name / switcher (`Menu`).
- Segmented control: **Board / List** (existing `PillTabs`).
- Filter: **All tasks / Assigned to me**, plus an optional member dropdown.
- Member avatars button → opens **Members** dialog.
- Overflow menu `⋯`: History, Leave team (creator sees Delete team instead).
- Primary **Add task** button.

Body: the same three columns (To do / In progress / Done). `InfoBanner` explains once: "Team tasks stay until someone removes them. Completed tasks move to History after 24 hours." (dismissible).

**C. Members dialog**
- List: avatar, name, "Creator" label. Creator sees a Remove action per member (with `ConfirmDialog`).
- "Invite by email" field + Send. Shows pending invitations with Cancel.
- Non-creators see a Leave team button.

**D. Task dialog (team variant)**
Title shows destination: "New task · Design team".
Fields in this order: Title, Description (existing rich editor with images), **Assigned to** (searchable member picker), **Estimate (days)**, Status. Then, below a divider:
- *Details*: Created by, created date, started date, due date (computed), all in Bangladesh time.
- *Chat*: message list + input.
- *History*: collapsed section, "Show timeline".
Chat and History are collapsed by default so the dialog opens looking like the personal one.

**E. History (`/teams/[teamId]/history`)**
- Reuses the History page layout and `HistoryTaskCard` style.
- Two `PillTabs`: **Completed** and **Removed**. Search by title.
- Each row: title, assignee, who/when (completed or removed, Bangladesh time).
- Removed rows have a **Restore** button.

### 3.4 Task card additions (the only change to cards)
- Bottom-right: small assignee avatar + short first name, or a muted "Unassigned".
- Estimate shown as a small chip ("3d"), reusing the existing minutes/estimate chip style. When the due day passes, the chip changes to a subtle overdue state using the existing status-error tone. No new color.
- A tiny message count with an unread dot when there is new chat.
- Hover/long-press actions stay the same as personal cards (Start, Complete, menu).

### 3.5 Empty, loading and error states
- Empty team: "No tasks yet. Add the first one." + Add task.
- Empty "Assigned to me": "Nothing is assigned to you in this team." (not the generic empty text).
- Skeletons reuse `BoardSkeleton` / `Skeleton`.
- Offline: a muted banner "Reconnect to make changes to this team." Board is read-only (cached view if built).
- Removed from team while viewing: friendly dialog, then redirect to Teams home. Cached team data is cleared.
- Long team names, long member names and many members truncate with ellipsis; avatars collapse to "+N".

### 3.6 Accessibility
- All new controls keyboard reachable; the member picker and `Menu` get full arrow-key support (currently missing in `Menu`; fix when adding).
- Avatars carry readable names (`aria-label`) in team contexts.
- Chat list uses `aria-live="polite"` for incoming messages.
- Contrast follows existing tokens, which are already AA-checked.

---

## 4. Data model (MongoDB, new modules under `backend/src/modules/`)

Follow the existing layout `modules/<name>/{interface,model,validation,service,controller,route,test}`.

### `team`
`_id`, `name`, `creatorId`, `createdAt`, `updatedAt`, `deletedAt`.

### `teamMember`
`_id`, `teamId`, `userId`, `joinedAt`, `leftAt` (null while active), `removedBy` (null when they left voluntarily).
Unique index on `(teamId, userId)` for active rows. Membership is the single source of truth for access.

### `teamInvite`
`_id`, `teamId`, `invitedUserId`, `invitedBy`, `status` (`pending | accepted | declined | cancelled`), `createdAt`, `respondedAt`.
Only one pending invite per `(teamId, invitedUserId)`.

### `teamTask`
Kept **separate** from the personal `task` collection so personal sync, history and reset logic cannot be affected.
`_id`, `teamId`, `title`, `descriptionHtml`, `descriptionText`, `status` (`todo | in_progress | completed`), `orderIndex`,
`createdBy`, `assigneeId` (nullable), `estimatedDays` (nullable int), `startedAt`, `completedAt`, `archivedAt`,
`removedAt`, `removedBy`, `createdAt`, `updatedAt`, `version` (integer, for edit-conflict detection).

### `teamTaskEvent`
Append-only timeline: `_id`, `teamId`, `taskId`, `actorId`, `type` (`created | status_changed | assigned | edited | removed | restored | archived`), `from`, `to`, `at`.
Written by the service layer in the same operation as the change.

### `teamMessage`
`_id`, `teamId`, `taskId`, `authorId`, `bodyText`, `bodyHtml` (images), `createdAt`, `deletedAt`.
Per-member read position: `teamTaskRead { taskId, userId, lastReadAt }` for unread dots.

### Images
Personal images live under `<UPLOAD_DIR>/<userId>/`. Team images live under `<UPLOAD_DIR>/teams/<teamId>/` and the authenticated image route checks **active team membership** before serving. Existing personal image rules are unchanged.

### Derived rules
- **Due date** = `startedAt` (Dhaka day) + `estimatedDays`. Computed, not stored. Moving back to To do clears `startedAt`; moving to In progress again sets it fresh. (**Open:** if a task goes back and forth, should the original start be kept? Default: keep first `startedAt` unless reset to To do.)
- **Auto-archive:** tasks with `completedAt` older than 24h get `archivedAt` set. Run by a scheduled job (the server already runs a 24h purge at boot; add an hourly job) *and* lazily when the board is read, so correctness never depends on the timer alone. Reopening a completed task before archive clears `completedAt`.

---

## 5. API (all under `/api/teams`, all require auth)

Every team endpoint re-checks **active membership** in the service layer. There is no endpoint that trusts a client-supplied team id without that check.

| Method + path | Purpose | Who |
|---|---|---|
| `POST /teams` | Create team | any user |
| `GET /teams` | My teams (+ counts) | any user |
| `GET /teams/:id` | Team + members | member |
| `DELETE /teams/:id` | Delete team | creator |
| `POST /teams/:id/invites` | Invite by email | member |
| `DELETE /teams/:id/invites/:inviteId` | Cancel invite | member |
| `GET /teams/invites` | My pending invites | any user |
| `POST /teams/invites/:id/accept` · `/decline` | Respond | invitee |
| `DELETE /teams/:id/members/:userId` | Remove member | creator |
| `POST /teams/:id/leave` | Leave | member (not creator) |
| `GET /teams/:id/tasks` | Board tasks (active + done < 24h) | member |
| `POST /teams/:id/tasks` | Create | member |
| `PATCH /teams/:id/tasks/:taskId` | Edit / status / assign / reorder (sends `version`) | member |
| `DELETE /teams/:id/tasks/:taskId` | Remove (soft) | member |
| `POST /teams/:id/tasks/:taskId/restore` | Restore | member |
| `GET /teams/:id/history` | Completed + removed, paged, `?q=` | member |
| `GET /teams/:id/tasks/:taskId/events` | Timeline | member |
| `GET /teams/:id/tasks/:taskId/messages` · `POST` | Chat | member |
| `POST /teams/:id/tasks/:taskId/read` | Mark chat read | member |
| `POST /teams/:id/uploads` | Upload team image | member |

Existing `/api/sync` is **not** extended in v1. Team data uses normal REST plus live updates, which keeps personal offline sync untouched and removes the hardest part of the original design.

Contracts go in `docs/API_SPEC.md` and `docs/DATABASE_SCHEMA.md` as part of the work.

### Conflict handling
`PATCH` carries the `version` the client last saw. If it is stale, the server returns `409` with the latest task; the UI shows "Someone updated this task. Review their changes" and keeps the user's unsent edit in the dialog so nothing is lost. No silent overwrite.

### Live updates
Extend the existing user-scoped SSE channel (`/api/sync/events`) with team events: task changed, new message, invitation received, membership changed. Events are delivered only to **active members**. On receiving one, the client refetches that team's data, preserving drafts, focus and scroll position. Routine teammate updates do not create toasts. The notification bus is single-process today (noted in `docs/ARCHITECTURE.md`), which is fine for this deployment.

---

## 6. Security and privacy checklist
- Active-membership check on every read, write, chat, history, and image request.
- Removed/left users lose access immediately, including SSE delivery and image access.
- Invite lookup by exact email only; no user directory or search-as-you-type. Rate limit invite attempts per user so the "does this email have an account" message cannot be used to enumerate users.
- Users can decline invitations; repeated invites to the same user are rate limited.
- Creator-only actions enforced server-side (remove member, delete team), never by the UI alone.
- All HTML (descriptions, chat) passes through the existing sanitizer (`backend/src/utils/sanitize`).
- CSRF rule unchanged: state-changing calls require the Bearer header.
- No team data appears in `/api/sync` responses, so personal sync cannot leak it.
- Personal tasks and notes are never queried by any team endpoint.

---

## 7. Frontend structure

```
frontend/src/app/(app)/teams/page.tsx                    Teams home
frontend/src/app/(app)/teams/[teamId]/page.tsx           Team board
frontend/src/app/(app)/teams/[teamId]/history/page.tsx   Team history
frontend/src/components/teams/                           TeamCard, InviteBanner, MembersDialog,
                                                         AssigneePicker, TeamTaskEditor sections,
                                                         TaskChat, TaskTimeline
frontend/src/hooks/useTeams.ts, useTeamTasks.ts          Data hooks (REST + live refresh)
frontend/src/lib/teams-api.ts                            Typed API client
```

- Team data is **not** put into Dexie in v1. Hooks use a small in-memory cache so the app has no second sync system to maintain. (Optional later: read-only snapshot in Dexie for the cached offline view.)
- `TaskBoard` and `TaskCard` are extended through props (`assignee`, `estimateDays`, `unreadCount`) rather than copied, so personal and team boards cannot drift apart visually.
- Dhaka formatting uses the existing `lib/time.ts` helpers.

---

## 8. Build order (each step shippable and testable)

1. **Foundations** — teams, members, invites: backend modules, tests, and the Teams home screen (create team, invite, accept/decline, leave, remove, delete). Rail/bottom-bar entry with invitation badge.
2. **Team board** — team tasks, status columns, assignment, day estimate, `Assigned to me` filter, board/list switch, empty states.
3. **History** — event log, auto-archive job, History tab, remove + restore.
4. **Images** — team upload route, membership-checked serving, editor wiring.
5. **Chat** — per-task messages, unread markers, count on card.
6. **Live updates** — team events over SSE; conflict (`409`) recovery UI.
7. **Polish and verification** — see §10.
8. **Docs** — update `docs/ARCHITECTURE.md`, `API_SPEC.md`, `DATABASE_SCHEMA.md`, add `docs/TEAMS.md`, and append evidence to `docs/AUDIT_LOG.md`.

Desktop (Electron) loads the hosted frontend, so the web release must be deployed first; then confirm Teams behaves in the desktop shell. Android is a later phase.

---

## 9. Invisible safety limits
No user-visible limits on teams or members. The server still enforces: max image size (existing), max message length, max description size (existing), and request rate limits on invites, messages and uploads, to stop one account overloading the shared VPS.

---

## 10. Verification plan

**Automated**
- Backend (Vitest + supertest): membership checks on every endpoint, creator-only actions, invite rules (unknown email, duplicates, decline, cancel), leave/remove behavior (tasks become unassigned), auto-archive at 24h, restore, `409` conflict, image access denied after removal, SSE only to active members.
- Frontend (Vitest): due-date calculation from `startedAt`, Dhaka time formatting, assignee/filter logic.
- E2E (Playwright, existing stack): create team → invite → accept → create task → assign → comment → complete → archive → restore; removed-member access loss; personal board unaffected.
- Run `npm run typecheck && npm run lint && npm test` in both `backend/` and `frontend/`, then `npm run check` at the root.

**Visual / UX audit (before calling it done)**
- Compare personal and team screens at 360, 768, 1024, 1440, 1920px, light and dark.
- Cases: long team and member names, rich descriptions, many members, many tasks, no tasks, filtered-empty, offline, pending invitation, keyboard-only use, axe accessibility (existing suite).
- Confirm a user with **no teams** sees no visible change beyond one nav icon.
- Confirm the personal board still resets at midnight and personal sync is unchanged.

**Deployment** (per `CLAUDE.md`): push to `main`, run `/opt/projects/task-web-app/deploy/update.sh`, keep service names `dayflow-web` / `dayflow-api`, never touch silvergym files, run `docker exec silvergym-nginx nginx -t` before any nginx reload. Record commits, checks and results in `docs/AUDIT_LOG.md`, separating user-reported feedback from independently verified checks.

---

## 11. Open items
1. Resolved: reset `startedAt` only on moving to To do; preserve it on completing/reopening.
2. Resolved: the `Network` icon distinguishes Teams from admin User management.
3. Resolved: defer the optional persistent read-only offline cache. Loaded data can remain read-only in memory during a connection failure.
4. Ownership transfer so a creator can eventually step away. (Deferred; not in v1.)

Implementation refinement: task events are embedded and appended atomically with
task writes on the existing standalone MongoDB. The timeline API remains separate.
Related models are grouped in the team module. See `docs/TEAMS.md` for the
single-process coordination boundary and the deployment/verification notes.
