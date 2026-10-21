# Engineering audit log

Dates/times use Asia/Dhaka (UTC+6) unless marked UTC. This log records implemented changes and observed verification. Earlier web work is preserved in the [implementation history](IMPLEMENTATION_PLAN.md); present behavior is defined by the current architecture and contracts.

## 2026-10-21 — Windows desktop 1.0.0

### Request and decisions

The owner wanted a floating Windows bubble, compact task/note panel, full workspace and synchronization with the existing website. Scope expanded from personal use to private sharing with friends using their own existing accounts.

- One repository: shared frontend/data layer/editors, existing backend and a separate Electron package.
- Hosted interface with cached offline use after initial setup; browser/desktop local storage remains independent.
- Default-browser Google sign-in with an expiring proof-bound handoff.
- User-scoped SSE triggers existing push/pull; polling/resume recovery and document-level last-write-wins remain.
- Windows 11 x64 per-user NSIS installer with manual native upgrades. Signing, automatic updates and public distribution are deferred.

### Source history

| Commit | Commit time, Dhaka | Work |
| --- | --- | --- |
| [`49162c0`](https://github.com/abdullahalkafi-dev/Task-web-app/commit/49162c0) | 21:48:59 | Electron package/installer, bubble/workspace, tray/shortcut/settings, isolated bridge, browser handoff, live sync, shared compact UI, saving, tests/docs, Node 24 containers and rollout tooling |
| [`f010974`](https://github.com/abdullahalkafi-dev/Task-web-app/commit/f010974) | 22:00:33 | Closing editors retain pending writes until saved, with retry; regression coverage and live verification tooling |
| [`559c9f6`](https://github.com/abdullahalkafi-dev/Task-web-app/commit/559c9f6) | 22:04:47 | Fresh cached-HTML revision per frontend build to prevent stale shell/chunk combinations; release records |

Final application revision observed on the live server: `559c9f6`. These are commit times, not deployment completion times. Delivered native code is captured by `49162c0`; later hosted save/cache fixes reach the same installer through website deployment.

### Installer fingerprint

| Field | Value |
| --- | --- |
| Filename | `Dayflow-Setup-1.0.0-x64.exe` |
| Size | 102,516,873 bytes |
| SHA-256 | `6504344819b43a8040d399c772c75f77044158c0f14d0db5f5113388027ddde5` |
| Local output | `desktop/release/`, including `SHA256SUMS.txt` and installation notes |
| Signing | Unsigned private release |
| Stable identity | `com.dayflow.desktop`; product `Dayflow`; session `persist:dayflow` |

Installers/checksums are generated artifacts, not Git-tracked binaries. A rebuild may produce a different hash. Retain the delivered binary separately when auditing this exact release.

### Observed verification

| Check | Result and limits |
| --- | --- |
| Type/lint and unit/API gates | Passed in all packages; final 73 tests: backend 38, frontend 32, desktop 3 |
| Production builds | Backend/frontend passed; Node 24 Docker builds passed locally and on the server |
| Frontend `npm run e2e` | All 15 browser scenarios passed: accessibility, task/note operations, authenticated images, offline recovery, responsive layout and midnight rollover |
| Desktop `npm run test:e2e` | Both real-Electron scenarios passed: native validation/isolation and browser handoff, task/note sync, images, retained drafts, account isolation and offline recovery |
| Save regression | Closing an editor immediately before collapse covered; failed local writes remain available for retry |
| Cache follow-up | Production build and three targeted offline/image/restart scenarios passed |
| Packaged executable | Isolated-profile check passed against final production: packaged mode, fixed origin, bridge v1 and browser sign-in screen |
| Visual review | Compact/expanded screenshots inspected |
| Live endpoints | Health/connect 200; unauthenticated SSE 401; invalid auth-start 400; fresh shell revision/desktop route confirmed |
| Public proxy streaming | Authenticated initial SSE event in 10ms initially and 12ms after final rollout; this measures transport, not total document propagation |

Commands were run for affected packages as changes landed; the final 32-test frontend suite followed the initial aggregate `npm run check`. E2E Google verification was stubbed only in the throwaway local backend. The packaged production check did not sign into a personal Google account. The live probe used a 30-second token for a random nonexistent user and performed no account/data writes.

Raw traces/screenshots remain local ignored artifacts; the table records outputs observed during implementation. Permanent archiving of raw evidence was not established.

### Deployment and rollback evidence

The owner explicitly approved pushing to main and deploying the matching website/backend in the conversation. Before the main rollout and save follow-up, MongoDB/uploads/proxy backups were created:

| Server backup directory | Dhaka time | Previous application revision |
| --- | --- | --- |
| `/home/deploy/backups/task-web-app/desktop-20261021T155100Z` | 21:51:00 | `d22a557` |
| `/home/deploy/backups/task-web-app/desktop-20261021T160055Z` | 22:00:55 | `49162c0` |

Directory suffixes are UTC. Each contains database/uploads archives, the prior Dayflow nginx configuration and `previous-commit.txt`. Creation/nonempty checks passed; restoration was not rehearsed.

Images were built before replacement, nginx was validated before graceful reload, and health checks passed. The final cache update replaced only Dayflow's web container. A TTL handoff collection was added; existing task/note schemas and data volumes were preserved. No unrelated project configuration was changed. Follow the [runbook](../deploy/README.md) for rollback; preserve profiles/outboxes and restore data only when needed.

### Feedback and outstanding work

On 21 October 2026 the owner reported: “wow its working.” This records general user-reported operational confirmation, not independent verification of every feature.

Remaining manual scenarios were not independently confirmed: real Google approval, Windows login startup, physical monitors/display scaling, installer upgrade/uninstall and exclusive full-screen behavior. No signing certificate, automatic native update channel or shared notification broker for multiple API replicas was configured.

## 2026-10-21 — Documentation completion

At the owner's request for future maintenance and audit, added the documentation index/change workflow and this dated release record. Linked the existing guides/runbook, recorded final revision/installer fingerprint/backups/checks and user feedback, clarified the historical Docker/auth notes, corrected the schema ID overview, and documented desktop endpoint limits and 429 behavior from source.

Validation: 23 local Markdown links resolved; whitespace/diff checks passed. This follow-up changes Markdown documentation only; runtime tests and application rebuild/deployment were not required. Its source reference is the Git commit containing this entry.

## Future entry format

Record date/request, decisions and compatibility impact, commit(s), actual tests and limits, deployed revision, installer version/hash, backup/rollback references, feedback and remaining work. Append corrections instead of erasing prior release history. Keep secrets and personal content out of this log.
