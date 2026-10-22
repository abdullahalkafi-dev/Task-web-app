# Dayflow Android

React Native/Expo client in the shared Dayflow repository. The website, Windows
companion and Android app use the same backend, accounts and canonical documents.

Start with [Android setup and architecture](../docs/ANDROID.md) and
[actual verification evidence](../docs/ANDROID_VERIFICATION.md). The agreed release
includes offline tasks/notes/images, history, local reminders, widget, sharing and
an opt-in floating task panel. Pending device checks are not release passes.

Use Node 24. Install dependencies with `npm ci` in this directory; use Expo's
versioned installation tooling for new native modules. From the repository root:

```powershell
npm run mobile:check
npm run mobile:editor-test
npm run mobile:native-test
npm run mobile:emulator
npm run mobile:e2e
npm run mobile:dist
```

Emulator E2E uses a throwaway backend and an isolated `emulator-*` device, never a
personal phone. `DAYFLOW_EMULATOR` selects its serial. Debug-only session fixtures
are excluded from release source sets. Native projects are generated from
`app.config.ts` and `plugins/`; Kotlin code belongs in `modules/dayflow-native`.

Release output is under ignored `release/`. Back up the private `.signing` identity
securely; never publish or commit it. Share only the verified ARM64 APK and checksum.
The optional `mobile:release-emulator` creates a separately named x86_64 release
for minification/startup checks; it is not the APK for phones.
