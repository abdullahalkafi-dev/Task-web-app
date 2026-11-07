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

## 2026-10-22 — Source-control hygiene during Android implementation

At the owner's request, checked both ignore rules and all tracked/untracked files that Git would include. Added ignore rules for nested native-module build output, Gradle/CMake caches, local toolchains, generated editor assets, private signing material, local cloud/agent settings, test/compiler output and packaged installers. Removed unused Expo scaffold configuration and five unused placeholder images; `mobile/app.config.ts` is the maintained app configuration. Source files, package lockfiles and `.env.example` remain available to Git. Docker also excludes local credentials, toolchains, native applications and build outputs from the backend/web build context.

Verification: `git check-ignore -v` confirmed representative Android/Windows installers, signing credentials, generated Android files, module build output, caches, test reports, local settings and environment files are excluded. No generated build output or credential files were already tracked. The initial scan covered 306 candidate files; after scaffold cleanup and the following source additions, a repeat scan covered 303 files with no private-key blocks, AWS access-key IDs, Google OAuth client secrets, GitHub token patterns or trailing whitespace found. This is a focused pattern scan, not a guarantee against every possible secret. `git diff --check` passed. Removed the task-created `J:` build alias after checking its target and confirming no owned Java process still used it; no project files were moved or duplicated. No files were pushed or deployed as part of this check; Android release verification remains in progress.

## 2026-10-22 — Android development storage review

The owner interrupted compatibility checks to ask about progress and low C: space.
At that point the full 14-scenario Android 15 and 16 runs had passed; Android 14
had passed 12 scenarios and was interrupted before completing its final two.
Stopped the owned test loop, its Metro child, the dedicated Android 14 emulator
and the throwaway local backend before measuring and cleaning generated files.

The project measured approximately 27.4 GiB logically: test AVDs 11.1 GiB,
mobile dependencies plus their native outputs 6.2 GiB, Gradle cache 5.3 GiB and
generated Android files 2.1 GiB were the major Android contributors. SDK system
images were another 28.2 GiB outside the project, including 8.2 GiB from the
pre-existing API 37.2 image. Logical folder sizes can differ from allocated disk
usage, particularly for virtual disks and shared files.

Verified each cleanup target was a real path inside this repository and checked
that no owned Java build was active. Removed the completed API 35/36 test profiles,
generated native build/CMake caches in five dependencies, and `android/app/.cxx`.
Measured free space increased from 12.97 to 23.89 GiB: 10.91 GiB reclaimed.
Source, signing key, APKs, reports, remaining SDK images and the owner's personal
Pixel emulator were retained. Added 20-GiB build and 15-GiB emulator preflight
checks, one-active-Dayflow-emulator enforcement, and explicit bounded test-profile
discard support. Script syntax checks passed. Native caches will need regeneration
for later native builds; existing debug/release APKs are retained.

## 2026-10-22 — Android implementation checkpoint (not a released APK)

Implemented the Android companion in `mobile/`, sharing Dayflow's accounts,
backend and document format. Added pure contracts/rules in `packages/shared` and
an editor extension factory in `packages/editor`. Kotlin owns per-account SQLite,
atomic outbox writes, private images, recoverable drafts, reminders, the widget,
incoming shares and the optional overlay. React Native owns screens, secure
sessions and foreground/overlay sync. The local WebView editor keeps credentials
outside its bridge and preserves canonical server HTML.

Added nullable `reminderAt` throughout the existing API and web editor. Omission
by older clients preserves reminders, explicit null clears them and history
copies start without the old reminder. Native notifications are Android-only.
Docker build contexts now include the shared packages. The confined Android
rollout script backs up Dayflow before pulling/building/replacing its two app
services; it has not been run at this checkpoint.

Verification evidence is maintained in [Android verification](ANDROID_VERIFICATION.md):
39 backend, 32 frontend, 13 mobile TypeScript, 13 Kotlin and 3 desktop unit tests
have passed, plus two real Electron scenarios. Full 14-scenario Android runs
passed on APIs 34, 35 and 36. The browser offline regression passed three repeated
runs after test readiness was corrected; its final aggregate run remains due.
The initial signed ARM64 APK measured 33.78 MB and passed signature, manifest,
ABI and 16-KB checks, but later fixes require a replacement artifact.

Real defects fixed during verification included duplicate ProseMirror runtimes,
incoming navigation intents, native return types, upload FormData compatibility,
outbox acknowledgement races, native surface lock ordering and image ownership
across recovered copies. Android 13 currently has a visible but untappable tab
bar; its initial navigation check reproduces the window-size mismatch before
editing. No full Android 13 pass or completed release is claimed.

After resuming, isolated Android tests moved to API port 4400 to avoid an existing
local port-4000 listener. Added project-only VS Code settings to prevent Java and
Gradle extensions from automatically importing native dependency projects; several
editor-started Gradle versions were observed alongside the owned build. Checked
their daemon logs and stopped two imports whose latest working directory was
exactly this Dayflow checkout, including their compiler children. The actual
project-local JDK 17 build, other projects and global preferences were retained.
This complements the storage limits and cleanup recorded above.

Source changes are still uncommitted and no Android backend/web rollout has
occurred at this checkpoint. Remaining gates include final compatibility,
production artifacts/regressions, deployment, real Google sign-in and the owner's
physical-device checks. The supplied Android OAuth ID and public certificate
fingerprints are documented in [Android guide](ANDROID.md); private signing
material stays ignored. Physical phones were deferred at the owner's request.

## 2026-10-22 — Final Android regression and packaging preparation

The complete browser regression run passed all 15 scenarios. Android 13 passed
the expanded 15-scenario workflow after a test-tool correction and a real sign-out
fix. Mobile type/lint checks and all 16 TypeScript tests passed; the three new
session tests cover invalidating callbacks before draft flush completes, switching
away/back, and restoring an account after secure-storage failure. Kotlin's 13
tests remain passing. Android 12's visible bubble exposed the older `mFrame`
diagnostic spelling, now supported by the harness; its complete rerun subsequently
passed all 15 scenarios too. API 32 emulator coverage remains pending under the
focused compatibility approach accepted after the owner's storage review.

The earlier Android 13 navigation diagnosis was corrected: direct taps worked.
Inspection of the emulator's own UIAutomator DEX showed `Display.getSize` supplied
reduced dimensions to the XML dumper, clipping valid tab nodes. Removed the app
window experiments and retained the normal edge-to-edge configuration. A roughly
2-KB test-only shell JAR calls the same OS dumper with actual screenshot dimensions;
it installs no app, uses real accessibility bounds and is excluded from releases.
The harness now waits for asynchronous navigation/state and handles retained
scroll positions. Temporary missing accessibility roots are retried without
misreporting them as Dayflow crashes.

The genuine logout race came from an old Settings read failing after native
account deactivation. Session epochs now invalidate those reads from the start of
the transition; stale success/error callbacks are discarded. Appearance reads
also use the account guard, with account-specific state. Storage uses readable
labels. Existing web/backend/desktop contracts are unchanged by these UI fixes.

Added explicit incremental development prebuild support: the observed rebuild
fell from about eight minutes after clean generation to 36–60 seconds while
retaining task history. Incremental stamps force clean generation before releases,
and release modes reject the incremental option. A focused scan covered 300 text
source files with no selected credential patterns or trailing whitespace; all 36
local Markdown links resolved. Final APK/deployment evidence is still pending and
will be appended separately. Physical devices and real Google sign-in remain
owner checks, as previously agreed.

## 2026-10-22 — Signed Android candidate and production support rollout

Application source was committed and pushed as
[`7d43039`](https://github.com/abdullahalkafi-dev/Task-web-app/commit/7d43039b039a7ef60549f5935ae14c0eb045d91d).
Both signed APKs were built from that revision with a clean working tree:

| Artifact | Evidence |
| --- | --- |
| Phone APK | `Dayflow-1.0.0-arm64.apk`, version 1.0.0/code 1, 33,824,401 bytes (33.82 MB) |
| Phone SHA-256 | `11018e9d42765e282c4f0111e8b644f9185bd3a24895b3c173ff43ff2f48d620` |
| Emulator APK | `Dayflow-1.0.0-emulator-x86_64.apk`, 34,384,161 bytes |
| Emulator SHA-256 | `bd70e036bf9594b33ad6edc1ec597f215c399b77c0263b6626be58fb5a75edc2` |
| Inspection | Protected-key signature, correct application ID/minimum 31/target 36, single intended ABI, no debug receiver/source maps/broad storage or camera/audio permissions, ZIP and all 24 native libraries aligned for 16-KB pages |

The APK outputs were hashed again after copying/cleanup and matched their metadata.
Signed minified startup passed on the dedicated API 36 emulator without Metro.
An in-place signed reinstall preserved the package UID and notification grant.
That check does not establish authenticated-data upgrade behavior. Selected API
31/33 fifteen-scenario and API 34/35/36 earlier fourteen-scenario reports, native
JUnit results, release startup screenshot and production smoke evidence were
retained under ignored `mobile/release/verification`. Installation instructions,
release notes, checksum and metadata accompany the phone APK.

Deployed only Dayflow's API and web containers from `7d43039`. The backup-first
script saved MongoDB, uploads, Dayflow proxy configuration and previous revision
`559c9f68b2fc286147e5f4b63920d09e86dee05d` under
`/home/deploy/backups/task-web-app/android-20261022T165759Z`; all backup checksums
were checked successfully. Both Docker images passed their type/lint/build gates.
The rollout made no proxy changes and did not replace MongoDB or other projects'
containers. One initial 502 during startup cleared on the next health attempt.

Post-deployment checks passed: public health/login/desktop handoff returned 200;
all eight referenced login JavaScript assets loaded; sync, SSE and private-image
routes returned 401 without authentication; the public Google audience remained
unchanged. A separate read-only check inside the deployed API verified reminder
omission/null validation, Date schema and legacy/UTC DTO output without database
writes. Real production Google sign-in and account synchronization remain phone
acceptance checks.

Storage cleanup retained source, release keys/APKs, downloaded dependencies and
test evidence. After verifying no retained emulator referenced them, uninstalled
only the task-installed API 31–35 system images. The owner's API 37.2 image and
personal Pixel profile remain; API 36 is retained for future development. All
completed Dayflow test profiles were discarded. With native builds stopped and
resolved workspace paths/link checks completed, removed generated Android,
five dependencies' CMake/build outputs and the project-local transform cache.
This final cache cleanup reclaimed 6.91 GiB, leaving about 50.5 GiB free on C:.
No temporary build drive alias remains. The next native build must regenerate
these outputs.

The Docker install also surfaced pre-existing dependency advisories. The
production-only frontend audit reported 29 moderate and one high affected package;
the high package is PostCSS. Upstream conditions and the limited call-site review
are recorded in [Android verification](ANDROID_VERIFICATION.md#dependency-maintenance-follow-up).
No relevant attacker-controlled CSS/arbitrary-attribute-object processing path
was identified in that review; this is not a blanket security clearance. Major
Next/TipTap dependency upgrades remain maintenance work, separate from this
compatible companion release.

The signed artifact is a candidate for owner testing, not a completed physical
acceptance claim. Pending: real Google/package/certificate verification, both
named phones' OS/hardware behavior, real three-way production sync, authenticated
upgrade and actual ARM64 installed size, battery/Doze/rotation/large-text and
remaining permission/lifecycle cases. API 32 UI coverage was deferred under the
focused compatibility approach. No physical device was connected and none of
those manual checks were marked complete.

## 2026-11-06 — Teams web/backend implementation

Implemented the owner-provided `TEAM_FEATURE_PLAN.md`: invitation-only teams for
existing accounts, consent before membership, creator-only member removal/team
deletion, shared tasks with immutable creator/one assignee, whole-day estimates,
24-hour completion archive, removed-task restore, per-task text/image chat,
unread markers, timeline, live refresh and version conflicts preserving drafts.
Teams reuse the personal board/card/dialog system through optional props. The
personal notes sidebar is omitted on team routes. No native release was built.

Personal schemas, sync payloads, outbox, uploads and daily-reset behavior are
unchanged. Team images require current membership, return no-store and bypass
service-worker caching. Timeline events are embedded in each task and written
atomically with the change, refining the planned separate event collection for
the existing standalone MongoDB. In-process queues/live notifications retain the
documented single-API-process assumption. There is no persistent team offline
cache. See [Teams](TEAMS.md) for behavior, data/API docs and deferred work.

Verification before deployment: root `npm run check` passed (54 backend tests,
35 frontend tests, 3 desktop tests/build and 16 mobile tests/editor build, with
typecheck/lint throughout). Both production packages built. The full Chromium
suite passed 17 tests, covering existing personal offline sync/images,
midnight rollover and history, plus two-account invitation, assignment, live
chat, preserved conflict edits, lazy archive/restore and removed-member access.
The team test captured both themes at 360/768/1024/1440/1920px with seven members,
twelve tasks, long names and a rich description, checking overflow/axe and
keyboard picker/menu behavior. Desktop/wide and narrow screenshots and the task
dialog were visually inspected. Final small refinements made card chat controls
open chat directly, clarified Remove wording and completion attribution, added
full assignee accessible names and kept long menus/picker choices in view;
final source typecheck/lint, both builds and all 17 browser tests passed again
after those refinements. Generated captures/traces remain ignored under frontend/test-results.

Environment-only interruptions were corrected without weakening checks: use
`npm.cmd` under Windows PowerShell execution policy; dependency/font/browser
downloads and the existing esbuild path resolution needed sandbox elevation.
The initial E2E import.meta/CommonJS test-path mismatch and missing test estimate
input were corrected. No production authentication bypass was introduced.

A final browser rerun exposed an existing offline-image test race: the final API
read sometimes preceded the image/task push even though the pill briefly said
Synced. The trace established the same account in both requests and a later
successful server push/pull containing the task. The regression test now polls
the persisted server HTML (retaining the uploaded-image/no-blob assertions) and
closes its manually created browser context. Personal sync production code was
not changed to address this test timing issue.

Production preflight confirmed a clean server checkout at
`012a3504e8e229cdf54d0dd0dd512dd531eed27d`, healthy Dayflow API/Mongo and running
web. The backup-first rollout records the previous revision and checksums before
calling `deploy/update.sh`; that updater now builds both images before replacing
only dayflow-api/dayflow-web and supports expected-revision verification. No
nginx edit/reload or other project's container change is required. Actual
deployment revision, backup path and post-deployment checks will be appended.

Limits: real production Google sign-in and real-account collaboration need owner
acceptance. Automated account flows use the existing throwaway Google stub.
Native desktop interaction/compact mode and Android Teams are deferred. Automated
checks do not establish physical-device behavior or a real-user usability study.

## 2026-11-06 — Teams deployment evidence

Application revision `d4d00bdad289ee846dbbfe4b8895e1127e09dd7e` was pushed to
main and deployed with the backup-first rollout. Previous revision:
`012a3504e8e229cdf54d0dd0dd512dd531eed27d`. Verified backup directory:
`/home/deploy/backups/task-web-app/teams-20261106T131758Z`, containing MongoDB,
uploads, Dayflow's previous proxy configuration, prior/deployed revision files
and SHA256SUMS. All four pre-deployment backup checksums passed. No proxy changes
or reloads were made. Only dayflow-api/dayflow-web were replaced; MongoDB retained
its two-week uptime and health. Both production Docker builds passed their
typecheck/lint/build gates. API startup logged only the normal listening message.

Read-only `deploy/verify-teams.cjs` passed against the public site: health,
login, Teams and desktop-connect returned 200; anonymous team listing,
invitations, tasks, history, messages, team images and SSE returned 401. The
deployed worker contains its separate team-image rule. Required membership,
pending-invitation, task, message and read-position indexes were verified in
MongoDB without account/content writes. Teams HTML returned 200 and all fourteen
referenced JavaScript assets returned 200. The final local browser suite passed
all 17 tests after the regression-test timing fix. Source typecheck/lint, 35
frontend tests and the 15 dedicated backend team tests passed on the final code;
the earlier root compatibility check also passed. No new native artifact was
built. Real-account production Google/collaboration and native desktop acceptance
remain manual checks as recorded above.

The unchanged dependency locks still report npm audit advisories during builds
(API production install: two high; full API install: ten moderate/three high;
full frontend build install: forty moderate/five high). No dependency upgrade or
`npm audit fix --force` was bundled into this feature release. These counts are
installation output, not a claim that each advisory is reachable in Dayflow;
the existing dependency-maintenance follow-up remains separate work.

## 2026-11-06 — Team header and dropdown polish

Implemented the owner's approved visual refinements: replaced the large circular
back arrow with a quiet Teams/Team board breadcrumb, kept single-team headings
plain, and showed a team switcher only for multiple teams. Replaced the native
member select with a theme-aware Assignee menu using the same chevron, panel and
checked-row treatment as team switching. Selected assignees show their name and
a clear action that restores focus. The filter/view buttons use matching 40px
heights. Existing tokens, colors, fonts and task-card styling are retained.

Menu selection is an optional extension to the shared Menu component; existing
action menus keep their roles/behavior. Selected rows expose menuitemradio and
aria-checked, long names truncate, and positioning uses untransformed width so
the opening animation does not reduce the narrow-screen margin. Heading names
remain the team name independently of the switch button's accessible action name.
No backend API, data model, authorization, sync or native code changed.

Verification: frontend typecheck, lint, 35 unit tests and production build passed.
The final full Chromium suite passed all 17 tests, including the extended team
layout check at 360/768/1024/1440/1920px in both themes, open-menu axe scans,
assignee selection/reset, Escape/focus return, single/multiple-team switching and
breadcrumb navigation. Open desktop/mobile menu captures were visually inspected.
QA corrected a popup screenshot to capture the viewport instead of scrolling a
full page (which legitimately dismissed the menu). A pre-existing offline-sync
test assertion now waits for both persisted server tasks, preserving its exact
content and second-device checks; production sync code is unchanged.

Deployed UI revision `c0be139132c3ddf76f43121d0651edcf1a9772e6` through the
backup-first rollout. Previous application checkout:
`d4d00bdad289ee846dbbfe4b8895e1127e09dd7e`. Backup directory:
`/home/deploy/backups/task-web-app/teams-20261106T171349Z`; MongoDB, uploads,
Dayflow proxy configuration and previous-revision checksums all verified. The
backend build reused its unchanged layers; the frontend production gate passed.
Only Dayflow API/web containers were replaced. MongoDB retained its two-week
uptime; no proxy configuration/reload or other-project changes were made. One
initial startup 502 cleared on the next health retry.

Read-only live verification passed: health/login/Teams/desktop-connect returned
200; anonymous team APIs/images and SSE returned 401; team-image service-worker
rule and required database indexes remained present. Teams HTML and all fourteen
referenced JavaScript assets returned 200. The follow-up documentation commit
records this evidence without another application build.

## 2026-11-07 — Structured paste and table editing (web/backend)

User reported that copying a formatted table into a note flattened its cells and
requested robust edge-case handling, implementation and deployment. Added optional
TipTap 2 table modules to the shared editor configuration and enabled them in the
hosted editor. HTML tables, GFM Markdown tables and consistent quoted TSV clipboard
data retain structure. Source presentation styles are normalized to Dayflow;
empty/merged cells, alignment, captions, text around tables and inline formatting
are supported. The contextual Table menu adds row/column/header/merge/split/delete
actions without another persistent toolbar. Wide tables scroll within the editor
and read-only view; personal task cards use compact previews for table descriptions.

Added clipboard limits, nesting/complexity checks, deliberate nested-table/image
fallback notices and transaction limits during table editing. Markdown rows with
excess cells are rejected with a plain-text alternative rather than accepting
GFM's silent truncation. HTML takes priority over its text/image clipboard
alternatives. Ctrl/Command+Shift+V stays literal and code-block paste bypasses
table conversion. Preview extraction separates cells and paragraphs.

Backend sanitization independently permits bounded table structure, strips unsafe
attributes/URLs and validates dimensions including merged/padded cells. Web requests
declare `X-Dayflow-Rich-Content: tables-v1`; sync and team edits from older clients
cannot replace an existing table description (409 `EDITOR_UPDATE_REQUIRED`). The
server copy is retained and unchanged-description metadata updates remain allowed.
No database migration, proxy change or native distribution is part of this release.
Existing Android builds still need table support; use the website for these
documents. See RICH_TEXT.md for behavior, limits and fallback details.

Backend typecheck/lint/build and 60 tests passed; frontend unit suite passed 45
tests. Existing mobile checks (16 tests/editor bundle) and desktop checks (3 tests
and build) passed with the optional shared extension contract. The first complete
Chromium suite passed 20 tests; visual review then identified squeezed mobile
columns, corrected with a readable minimum width and genuine data-theme captures.
Final frontend typecheck/lint/production build and the full 21-test Chromium suite
passed after that correction. New browser checks cover the supplied five-row
timeline in notes and team tasks; HTML task tables; undo/redo; cell paste without
nested tables; literal paste; rejected oversized clipboard data; empty-table
autosave/reload; rejected column growth without mutation; offline edit/reload/sync;
360/768/1440px tables in both actual data-theme modes; narrow-screen column width
and internal scrolling; and an axe scan. Final desktop light and mobile dark
captures were visually inspected. Shell/Node syntax checks passed for the release
scripts. Deployment evidence is recorded in a follow-up entry.

Dependency choice: table extensions pinned to the installed TipTap 2.27.3 runtime;
markdown-it pinned to patched 14.3.3 after checking its advisories. Existing broader
dependency advisories are not addressed by unrelated forced upgrades. No claim of
manual acceptance across every external application's clipboard format is made.

Deployment order now builds both images, waits for the compatible API to be
healthy, then replaces the frontend. This prevents new table writes reaching the
previous sanitizer. Existing backup-first rollout remains the release entry point.

## Future entry format

Record date/request, decisions and compatibility impact, commit(s), actual tests and limits, deployed revision, installer version/hash, backup/rollback references, feedback and remaining work. Append corrections instead of erasing prior release history. Keep secrets and personal content out of this log.
