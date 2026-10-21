# Desktop implementation checklist

See the [audit log](AUDIT_LOG.md) for dated source/deployment history and owner feedback, and the [documentation index](README.md) for future change workflow.

Target: private Windows 11 x64 installer for the owner and friends. Hosted shared interface, per-user existing accounts, offline access after setup, fast sync, manual upgrades.

- [x] Strict-TypeScript Electron package, independent lockfile, root commands, shared bridge v1.
- [x] Bubble, persistent compact/expanded workspace, pin, tray, configurable shortcut, settings, display clamping, single instance, optional login startup.
- [x] Default-browser authentication, explicit account/code approval, proof-bound five-minute MongoDB requests, atomic exchange.
- [x] Shared editors, local-save acknowledgement, preserved drafts, isolated accounts and offline readiness indicator.
- [x] User-scoped SSE, one stream leader per user/browser, reconnect, polling fallback and proxy configuration.
- [x] Per-user NSIS installer configuration, stable application identity and retained local data.
- [x] Development, architecture, API, schema, deployment, sharing and troubleshooting documentation.
- [x] Local verification and installer creation.
- [x] Live rollout and packaged executable smoke test.

## Verification

Verified on 21 October 2026: strict type/lint checks for all packages; backend 38 unit/integration tests; frontend 32 unit tests; desktop 3 unit tests; all 15 browser E2E tests; both real-Electron E2E scenarios (native validation plus browser handoff, two-way task/note sync, images, retained drafts, account isolation and offline recovery); Node 24 Docker builds for frontend/backend. Compact and expanded screenshots inspected. NSIS x64 installer built successfully.

The desktop support was pushed and deployed to the existing site with MongoDB/uploads/proxy backups at `/home/deploy/backups/task-web-app/desktop-20261021T155100Z`. Public health/connect routes, auth validation and unauthenticated stream rejection passed. A short-lived synthetic probe received the authenticated initial SSE event through public nginx/Next.js in 10ms. The packaged executable passed production-origin, isolated-profile, bridge and browser-sign-in-screen checks.

Installer: `Dayflow-Setup-1.0.0-x64.exe`, 102,516,873 bytes. SHA-256: `6504344819b43a8040d399c772c75f77044158c0f14d0db5f5113388027ddde5`. Also delivered in `desktop/release/SHA256SUMS.txt`.

The final save-boundary follow-up passed all 15 browser and both Electron scenarios, including closing a task editor immediately before collapse, and was deployed with an additional backup at `/home/deploy/backups/task-web-app/desktop-20261021T160055Z`. Cached HTML now receives a fresh build revision; its production build and all three offline/image/restart regression scenarios passed.

Manual checks not automated: real Google account approval, Windows login startup, multiple physical monitors/scaling, installer upgrade/uninstall and exclusive full-screen behavior. No signing certificate or automatic desktop update channel is configured.

Final release confirmation: live application revision `559c9f6`; the final probe confirmed fresh shell revisions and authenticated SSE delivery in 12ms. The packaged executable passed again against that deployment. The owner subsequently reported the app working; individual remaining manual scenarios were not inferred from that general feedback.
