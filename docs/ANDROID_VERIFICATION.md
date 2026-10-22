# Android implementation and release verification

Status: signed release candidate built, automated checks completed below, and backend/web support deployed. Physical-phone and real Google acceptance remain pending before broader distribution.

## Agreed release

Private signed ARM64 APK; Android API 31–36; 40 MB download target. Full tasks/notes/images/history/offline workflow plus one-time reminders/snooze, Today widget, incoming sharing and compact overlay. One complete external release; internal milestones are not partial product releases.

## Observed checks — 22 October 2026

| Check | Actual result |
| --- | --- |
| Backend unit/API tests | 39 passed, including reminder omit/null/copy compatibility |
| Frontend unit tests | 32 passed |
| Mobile TypeScript tests | 16 passed, including pending-image deletion, independent image ownership, account-read invalidation during logout, switch-away/back and secure-session rollback; typecheck and lint passed |
| Desktop unit checks/build | 3 passed; typecheck/lint/build passed |
| Real Electron E2E | 2 passed after shared editor changes |
| Browser E2E | Final aggregate run passed all 15 scenarios, including offline restart/images and light/dark accessibility. A teardown-only duplicate Mongo cleanup produced a Windows file-lock warning after the passes; shutdown is now guarded against re-entry |
| Frontend production build | Passed after eliminating duplicate TipTap/ProseMirror instances |
| API and web Docker builds | Final images built with type/lint gates and deployed from `7d43039`; public health/login/desktop routes and eight JavaScript assets passed |
| Android ARM64 release build | Final signed APK: 33,824,401 bytes (33.82 MB), below 40 MB; source `7d43039`, clean tree at build time |
| APK inspection | Final signature matches the protected release key; ARM64 only; min 31/target 36; no debug receiver/source maps/broad storage or camera/audio permissions; all 24 native ELF libraries and APK archive pass 16 KB alignment |
| Kotlin repository/reminder tests | 13 passed: transactions, ack races, conflicts, stale reset, account isolation, concurrent writes, draft image retention, section order, delivery deduplication, snooze, completion and stale/wrong-account alarms |
| Android 16 emulator | Full 14-scenario run passed on API 36 after the final image-copy changes: tasks, server updates, rich text, link share, history copy, overlay, widget, offline task/image restart, reminders, revoked overlay access, account isolation and sign-out |
| Android 15 emulator | The same complete 14-scenario suite passed on API 35; fresh AOSP profiles use explicit ADB routing to Metro because RN does not recognize their `emu64x` fingerprint |
| Android 14 emulator | A complete rerun passed all 14 scenarios after the storage review; its test profile was then discarded. The earlier interrupted attempt passed 12 scenarios |
| Android 13 emulator | Full 15-scenario run passed after correcting the shell snapshot tool and fixing the real stale-Settings callback on sign-out. Includes widget, bubble, offline task/image restart, reminders, account isolation and a clean login screen after logout |
| Android 12 emulator | Full 15-scenario run passed on API 31, including widget, bubble, offline task/images, reminders, account isolation and sign-out. The test parser supports its older `mFrame` window-diagnostic spelling |
| Signed minified release | Separate signed x86 release started on API 36 without Metro. In-place reinstall preserved package UID and notification grant. This does not verify an authenticated database upgrade or real Google login |
| Production reminder contract | Deployed validator preserves omission/null behavior, schema is Date, and legacy/UTC DTO checks pass without database writes. Unauthenticated sync/SSE/private-image requests return 401; Google audience unchanged |
| Bundled editor browser-engine check | Passed formatting, edit/flush, canonical URLs, distinct identities for identical image bytes, and cache rendering that creates no document edits |
| Native workflows observed | Full API 36 suite passed all 14 scenarios. A prior targeted run passed five image/reminder/account scenarios; earlier aggregate attempts exposed emulator/test-harness issues and are not counted as passes |
| Real Google sign-in | Owner supplied Android OAuth client ID; its project-number prefix matches the public web client. Actual certificate/package registration and real sign-in remain unverified |
| Physical phones | No physical phone connected; owner explicitly requested emulator checks for now |

Earlier editor E2E failures were real regressions and were fixed by dependency injection into the shared extension factory; they are not counted as passes. An initial desktop E2E attempt encountered occupied test ports and did not execute; the later sequential run passed.

Android testing also found and corrected share intents missing `ACTION_VIEW`, an
unsupported native return type after enabling the bubble, draft-clear ordering,
and offline-image deletion being held in the outbox. One emulator run produced an
ANR while builds and SDK installation were running with little host memory free;
its main-thread trace did not identify a repository lock. UI checks are being run
separately from heavy builds. A later full-run startup was covered by an emulator
System UI ANR while Dayflow had already rendered Today and synced. The dedicated
API 36 emulator allocation was raised from 1.5 GB/two cores to 3 GB/four cores,
and the harness now rejects failed/stale UI snapshots. These failures are retained
as findings, not passes.

The SDK 58 native artifacts require compile API 37. The build uses compile 37,
target 36 and minimum 31; disabling AAR metadata checks was not used. Smaller AOSP
images for APIs 33–35 have been installed. An earlier progress note assumed the
API 31–32 installation had stopped; a later storage audit confirmed their
`source.properties` and full image files exist, so they are installed too. API 35
and Android 14 now pass all 14 scenarios. Android 13 subsequently passed the
expanded 15-scenario run. API 31 also passed all 15. API 32 has not been exercised in
an emulator. The owner requested focused compatibility coverage after the storage
review; no further system images are being downloaded.

After resuming, an existing local listener on port 4000 prevented the temporary
test API from responding. Android tests now default to isolated API port 4400
(configurable), use a bounded health request and skip the unused Next server.
This does not change the production API or stop the existing local service.
The newly added initial tab-navigation scenario increases future complete runs
to 15 scenarios; earlier 14-scenario results above are unchanged.

The Android 13 finding above was initially misdiagnosed as an app window problem.
Early window initialization, a theme-only opt-out and a startup-flag experiment
did not fix the shell tool's clipping. Those product experiments were removed.
The corrected test helper changes neither accessibility node positions nor tap
coordinates; it uses the real display dimensions and ordinary label-based taps.
It is a small shell JAR built with the existing SDK, not another installed app,
and is excluded from the production APK.

## Release gates

- [x] Signed ARM64 APK built, signature verified, size recorded and SHA-256 computed.
- [x] APK <= 40,000,000 bytes, or documented size review accepted before sharing.
- [x] Kotlin transactions/migrations/concurrency/account-isolation/recovery tests pass.
- [x] Mobile startup, task/note editing, formatted content and images verified in emulator (API 36).
- [ ] Web ↔ Android ↔ Windows sync, deletes and recovery verified with synthetic test accounts.
- [x] Overlay permission revoked, reminders, notification actions, widget and overlay exercised (API 36; remaining permission/lifecycle cases below).
- [x] Offline edit/image insertion, process termination/relaunch and reconnection exercised (API 36).
- [ ] APIs 31, 32, 33, 34, 35 and 36 emulator coverage recorded individually.
- [ ] iQOO Neo 9 and Realme 8 Pro versions recorded and physical scenarios performed.
- [ ] Google Android OAuth client configured; real sign-in and account switching confirmed.
- [ ] Upgrade over the previous signed APK verified; uninstall behavior explained.
- [ ] Battery saver/Doze, keyboard, rotation, accessibility/large text and Dhaka rollover checked.
- [x] Dayflow backend/web deployed with backups and public health/contract checks.
- [x] Installation instructions, artifact evidence, source revision and remaining limits audited.

Do not change pending items to complete based on an unrelated successful check or general user feedback. Generated traces/screenshots are ignored local artifacts; archive selected evidence with the release if long-term retention is required. Keep tokens, signing passwords and personal content out of audit records.

## Candidate artifact and retained evidence

`mobile/release/Dayflow-1.0.0-arm64.apk`, version 1.0.0/code 1, SHA-256:
`11018e9d42765e282c4f0111e8b644f9185bd3a24895b3c173ff43ff2f48d620`.
The matching checksum, metadata, installation notes and selected emulator/JUnit
reports are retained in the ignored release directory. The emulator APK is a
separate 34,384,161-byte x86 artifact, not the phone download measurement.

Actual ARM64 installed storage has not been measured on a phone. Downloaded image
cache has a 100-MB budget; durable unsynced images and account data are separate.
All dedicated test profiles were discarded after recording results. Unused
task-installed API 31–35 system images were uninstalled; API 36 and the owner's
personal API 37.2 image remain. Final generated-project/native-output/transform
cleanup reclaimed 6.91 GiB and left approximately 50.5 GiB free. Source, keys,
downloaded dependencies and release/test evidence remain; native outputs must
regenerate for the next build.

## Dependency maintenance follow-up

The final Docker install reported existing dependency advisories. A production-only
frontend audit returned 30 affected packages (29 moderate, one high); the high
package is PostCSS. Its [CSS stringification](https://github.com/advisories/GHSA-qx2v-qp2m-jg93)
and [source-map loading](https://github.com/advisories/GHSA-6g55-p6wh-862q) conditions
require attacker-controlled CSS. The flagged frontend copy is used by the build
pipeline; Dayflow does not offer a user CSS-processing endpoint.

The [TipTap attribute-merging advisory](https://github.com/advisories/GHSA-cp6q-959q-f8rh)
requires untrusted attribute objects. Dayflow supplies HTML through fixed editor
schemas and does not import arbitrary document/plugin attribute objects. This
limited call-site review identified no such paths; it does not clear the upstream
advisories. Major Next/TipTap upgrades remain maintenance work requiring separate
editor/offline compatibility verification. No automatic force-upgrade was applied.
