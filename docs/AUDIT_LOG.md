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

## Future entry format

Record date/request, decisions and compatibility impact, commit(s), actual tests and limits, deployed revision, installer version/hash, backup/rollback references, feedback and remaining work. Append corrections instead of erasing prior release history. Keep secrets and personal content out of this log.
