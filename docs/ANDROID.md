# Dayflow Android

Android implementation and release operations. Current verification evidence belongs in [Android verification](ANDROID_VERIFICATION.md) and the [audit log](AUDIT_LOG.md). A successful build is not a substitute for device verification.

## Product and boundaries

Private, signed ARM64 APK for Android 12–16 (minimum API 31, target API 36), application ID `com.dayflow.mobile`. The mobile app uses the existing Dayflow production account and APIs. Its native interface is React Native with Expo SDK 58; local TipTap runs inside the system WebView. There is no bundled Chromium, alternate backend or database service. Administration stays on the website.

The release includes Today, task/note editors, image attachments, History/copy-to-today, local drafts and recovery, offline sync, local task notifications, a Today widget, incoming shares and an opt-in task overlay. Recurring reminders, remote push delivery, iOS, public store distribution and automatic updates are deferred.

## Code ownership

| Layer | Owner |
| --- | --- |
| Mobile screens/navigation/session/sync | `mobile/src`, Expo Router, TypeScript |
| Shared domain contracts and pure rules | `packages/shared`, no DOM/native imports |
| Shared editor extensions | `packages/editor`; callers supply their own TipTap runtime to prevent duplicate ProseMirror plugins |
| SQLite, overlays, widget, alarms, incoming Android intents | `mobile/modules/dayflow-native`, Kotlin/Expo Modules API |
| Native project generation and signing configuration | `mobile/app.config.ts`, config plugin and build scripts |
| Account verification, authorization, durable server data | Existing Express/MongoDB backend |

The generated `mobile/android` directory is ignored. Make native changes in the local module/config plugin, then regenerate; do not maintain patches inside generated native sources.

## Development and builds

Use Node 24 and a compatible Android SDK/NDK. The verified project setup uses JDK 17 for React Native Gradle plugins; `DAYFLOW_JAVA_HOME` can select another compatible installation. A project-local JDK at `.tools/jdk17` is preferred over changing the machine's global JDK. Neither tools nor caches are committed.

Expo SDK 58's published native artifacts require **compile SDK 37**. The build
therefore compiles against 37 while retaining target API 36 and minimum API 31.
This is a build-tool adjustment to the original compile-36 plan; it does not raise
the minimum supported phone version. Install Android platform 37 alongside the
API 31–36 test images. The metadata check rejected compile 36; do not disable it.

Install package dependencies in `backend`, `frontend`, and `mobile` with `npm ci`. Shared packages are local file dependencies and must be present in the checkout. Run commands from the repository root:

```powershell
npm run mobile:check
npm run mobile:dev
npm run mobile:emulator
npm run mobile:dist
```

`mobile:check` bundles the editor, typechecks, lints and runs TypeScript tests. `mobile:emulator` creates an x86_64 debug APK; the distributable uses ARM64. `mobile:dist` generates the native project when configuration changes and runs the signed release build. Google/native modules require a development build, not Expo Go.

Expo SDK 58 cleans generated projects by default during prebuild. For iterative
native configuration work, `node mobile/scripts/android-build.mjs emulator
--incremental` uses Expo's `--no-clean` option and retains Gradle task history.
This still runs configuration plugins; it does not permit hand edits to generated
native code. The stamp marks incremental generation, forcing clean generation
before the next release build. Release modes reject `--incremental`.

`mobile:emulator` also runs the Kotlin tests. `mobile:editor-test` exercises the
actual bundled editor in Chromium without credentials. `mobile:device -- 36`
starts the dedicated Android 16 emulator; pass `--stop` to stop it. APIs 31–35 use
small AOSP images, API 36 uses Google APIs; install the matching SDK image first.
These profiles live under ignored `.tools/avd`, use fixed ports, and never reuse a
personal emulator. Set `DAYFLOW_EMULATOR` for `mobile:e2e`. Set
`DAYFLOW_E2E_EXTENDED=1` for images/reminders/account recovery. The integrations-only
mode is an internal debugging shortcut and does not count as the full UI suite.

Android E2E normally starts its own throwaway API on port 4400, Metro on 8081 and
the offline-test proxy on 4100; it does not need Next. Override
`DAYFLOW_E2E_API_PORT` to avoid an occupied local port. For investigation, start
`node e2e/stack.mjs` from `frontend/` with that same API port, then set
`DAYFLOW_E2E_EXTERNAL_STACK=1` for the harness. The external stack is retained.
The browser stack defaults to API 4000 and Next 3100. Run UI checks separately
from native/Docker builds on hosts under memory pressure.

For APIs 31–33, the test harness builds a roughly 2-KB shell JAR from
`mobile/e2e/dump/DayflowDump.java` with the installed JDK/SDK. It calls the device's
own UIAutomator dumper with full screenshot dimensions, avoiding a reduced-display
clipping bug in the shell dump command. It uses real accessibility labels/bounds
and normal taps, installs no APK, and is never part of the app. The temporary
device JAR is removed after the run; host output is ignored test data.

Local builds use the protected local key. EAS cloud builds, cloud credentials and
OTA updates are not configured; do not assume a cloud build will share this key.

The Windows build helper detects long workspace paths, creates or reuses an unused SUBST alias pointing to this repository, and normalizes Expo autolinking paths to that alias. This avoids Ninja object-path limits and mixed-drive Gradle errors. It never relocates the repository or changes global long-path settings. Aliases created by the helper are removed on process exit; an existing alias is preserved. Build scripts pass signing passwords through child-process environment variables, never command-line arguments.

Release files are written under ignored `mobile/release`: versioned APK, SHA256SUMS and release metadata. The target is **40,000,000 bytes** for the signed ARM64 download. Record actual installed storage separately; user images and the download cache are not part of APK size. An overrun needs a documented review before distribution.

The release helper verifies the actual certificate, manifest, ABI, source-map
exclusion, APK zip alignment and every native ELF load segment's 16 KB alignment
before copying an artifact. Metadata includes source revision/dirty state. The
optional `mobile:release-emulator` uses the same release settings with x86_64 and
separate artifact/checksum/metadata names; never send that build to ARM64 phones.

## Development storage

The small APK size does not represent development disk usage. Android system
images, emulator user-data disks, Gradle caches and native compilation output can
use tens of GiB. `.gitignore` excludes those files from GitHub; it does not remove
them from local storage.

Builds require at least 20 GiB free before starting. Starting a test emulator
requires 15 GiB free, and the helper permits only one running Dayflow test emulator.
These preflight limits reduce risk; they are not a fixed upper bound on build size.
Use existing SDK images sequentially rather than installing a batch of versions.
After recording a successful run, use `npm run mobile:device -- 35 --stop --discard`
(with the tested API number) to remove that dedicated profile and its synthetic
data. Reports remain under `mobile/test-results`. Keep failed profiles only while
investigating them. The helper verifies the emulator name and workspace cleanup
paths before stopping or deleting anything.

Generated `android/app/.cxx` and native dependencies' `android/.cxx` / `android/build`
directories can be regenerated. Removing them saves space but makes the next
native build slower. Keep source, package lockfiles, release artifacts needed for
distribution and the protected `.signing` identity. Do not remove personal AVDs or
pre-existing SDK versions as part of Dayflow cleanup.

The repository's VS Code settings disable automatic Gradle discovery, Java
Gradle import and automatic Java builds. Use the documented npm build commands
for this mixed web/native workspace. This prevents editor extensions from
importing dependency sample builds and starting separate Gradle versions/caches.
For native IDE work, open the generated `mobile/android` project separately in
Android Studio using the project-compatible JDK. These workspace settings do not
change global IDE preferences or stop already running editor processes.

## Signing and Google setup

The local release script creates a persistent private key on first use under ignored `mobile/.signing`. Keep that key and its credentials in a protected backup: all future updates must use the same key. Never commit or send those files to friends. Friends receive only the APK and its checksum. Increment Android versionCode for each update.

Run `node mobile/scripts/signing-info.mjs` to produce public fingerprints. For the initially generated key:

- Package: `com.dayflow.mobile`
- SHA-1: `76:4B:B8:2F:A9:3C:5B:67:C6:4D:FF:FB:0F:F8:36:6A:7D:F4:57:43`
- SHA-256: `89:C1:02:54:13:93:34:09:CF:E5:06:01:A8:B7:52:5D:C8:E0:E7:B6:A4:EB:D8:D0:81:F1:B6:FE:75:76:A9:6F`

In the Google Cloud project that owns Dayflow's existing web OAuth client, create an **Android OAuth client** with that package and SHA-1. The app fetches the existing web/server client ID from `/api/auth/config` and requests an ID token for that audience. The backend keeps its existing Google signature/audience/email verification. No client secret belongs in the app. Debug signing uses a separate certificate and requires a separate Android OAuth registration for real Google testing.

Google project registration and a real-account sign-in must be verified separately from mocked authentication in local tests. Do not describe those as complete solely because a sign-in screen renders.

On 22 October 2026 the owner supplied Android client ID
`511422484545-vv8nq37d24hrubp9s3164d9r1dk9tk50.apps.googleusercontent.com`.
This is public registration metadata, not a secret. Its package, certificate and
owning project still need confirmation through real Google sign-in. Do not replace
the existing server/web client ID with this Android ID.

## Storage, sync and recovery

SQLite is owned by one synchronized native repository. App, widget, overlay and notification actions use the same transactions. Each user has a separate database and private image directory. Document updates and outbox entries commit atomically. JWTs remain in Android-backed SecureStore; there is no session token in editor HTML, URLs, SQLite documents or diagnostics.

The sync coordinator uploads committed pending images, pushes batches of at most 100 changes, then pulls using the server cursor. SSE signals changes; foreground/overlay polling and exponential retry remain fallbacks. Uncommitted draft images stay local. Acknowledgements clear only sent outbox sequence numbers, so an edit made during a request survives. Account shutdown aborts networking and rejects late results. Failed/rejected pushes retain local changes.

The app has live sync while foregrounded or while its visible overlay is enabled. Screen lock/screen-off suspends the overlay sync task rather than holding a permanent wake lock. When app and overlay are inactive, server changes arrive on the next successful sync. There is no closed-app push-delivery promise.

Conflicts retain recoverable local copies. An editor receiving a remote update/deletion retains its draft and shows a review notice; a deleted item is saved as a new copy rather than silently resurrected. Beyond the server's 30-day tombstone window, a full snapshot is reconciled before pushing: missing previously acknowledged records are removed from the active cache, with pending edits retained for recovery. Never-uploaded records remain queued.

Cached downloaded images have a 100 MB budget. Pending private images are excluded from eviction until document acknowledgement and draft/reference checks allow removal. Original device paths/base64 rendering data never enter the server HTML. Supported image types/10 MB limit match the website.

## Reminders and compatibility

Task `reminderAt` is UTC ISO or null. Input/display uses Asia/Dhaka, independent of the phone timezone. Older clients omitting the property preserve a stored reminder; explicit null clears it. Copy-to-today starts without a reminder. Backend DTOs normalize old records to null; existing caches need no destructive migration.

One-time reminders are scheduled locally after data reaches the phone. Open, Complete and Snooze 10 minutes use the same repository; snooze updates `reminderAt` and syncs normally. Completion/deletion cancels scheduling. Stable identities and delivery records prevent duplicate alerts. Boot, upgrade, time and permission changes reconcile schedules; overdue tasks stay visible without a burst of stale notifications.

Notification access and exact-alarm access are requested in context. Without precise-alarm access, Android may delay delivery. Permission denial does not block ordinary task/note use. Web/Windows can edit reminder settings but do not deliver notifications in this release.

## Overlay, widget and shares

The bubble uses an explicitly started `specialUse` foreground service and `TYPE_APPLICATION_OVERLAY`. It snaps to an edge, opens a compact Today panel, supports quick add/status changes, and expands into the app for full editing. A visible service notification provides Stop. It hides over the main app and lock screen; there is no boot/force-stop auto-restart. Losing overlay access leaves the normal app usable.

The resizable Today widget displays a local task snapshot, completion count and sync time, with open/add/complete actions. It does not maintain its own network connection. Signed-out/account-switched states must never display another account's data.

Incoming text/links/images are copied to durable private storage before capture. Capture IDs and per-account selection markers make retry/recreation idempotent. Saving opens the regular editor; it uses the same outbox/image pipeline. Incoming captures survive a sign-in interruption.

## Installation, updates and troubleshooting

Share the signed APK and SHA256SUMS privately. On Android, permit installation from the particular browser/file manager used to open it, install, and sign in with the website account. Add the widget through the home-screen Widgets menu. Enable the bubble/notifications only when wanted in Dayflow Settings.

For an update, install the newer signed APK over the existing app without uninstalling. Uninstalling removes local unsynced drafts and private files; it does not remove server data. Never uninstall as an initial troubleshooting step when pending edits exist.

- Google sign-in configuration error: check package, release/debug SHA-1 and the owning OAuth project.
- Bubble absent: check overlay access, service state, screen lock and whether the app is already foregrounded.
- Reminder late: check notifications/exact-alarm access and the actual phone's battery settings; website edits require a successful phone sync.
- Sync sign-in error: reauthenticate the same account; retain local data.
- Size mismatch: compare release.json and SHA256SUMS; distinguish debug/universal builds from the signed ARM64 release.

Record manufacturer-specific settings only after observing them on that phone. Battery behavior, upgrade compatibility and real Google sign-in remain device/account checks even when automated tests pass.

## Backend/web rollout and rollback

Deploy backward-compatible reminder support before distributing the APK. Follow the existing [deployment runbook](../deploy/README.md): back up Dayflow data/uploads and record the prior commit, build both images, start only Dayflow services, and verify health/auth/sync. The new Docker build context is the repository root so local shared packages are available; `.dockerignore` excludes secrets, native artifacts and tools.

Rollback to a release that still preserves `reminderAt`; an older binary may stop exposing reminders. Do not restore the database merely to roll back application code. No changes to other projects on the shared VPS are part of Android rollout.
