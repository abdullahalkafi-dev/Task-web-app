# Desktop implementation checklist

Target: private Windows 11 x64 installer for the owner and friends. Hosted shared interface, per-user existing accounts, offline access after setup, fast sync, manual upgrades.

- [x] Strict-TypeScript Electron package, independent lockfile, root commands, shared bridge v1.
- [x] Bubble, persistent compact/expanded workspace, pin, tray, configurable shortcut, settings, display clamping, single instance, optional login startup.
- [x] Default-browser authentication, explicit account/code approval, proof-bound five-minute MongoDB requests, atomic exchange.
- [x] Shared editors, local-save acknowledgement, preserved drafts, isolated accounts and offline readiness indicator.
- [x] User-scoped SSE, one stream leader per user/browser, reconnect, polling fallback and proxy configuration.
- [x] Per-user NSIS installer configuration, stable application identity and retained local data.
- [x] Development, architecture, API, schema, deployment, sharing and troubleshooting documentation.
- [x] Local verification and installer creation.
- [ ] Live rollout and packaged executable smoke test.

## Verification

Verified on 21 October 2026: strict type/lint checks for all packages; backend 38 unit/integration tests; frontend 31 unit tests; desktop 3 unit tests; all 15 browser E2E tests; both real-Electron E2E scenarios (native validation plus browser handoff, two-way task/note sync, images, retained drafts, account isolation and offline recovery); Node 24 Docker builds for frontend/backend. Compact and expanded screenshots inspected. NSIS x64 installer built successfully.

Pending final rollout: deploy to the existing server with backups, verify production endpoints, and smoke-test the packaged executable. Installer SHA-256 is delivered in `desktop/release/SHA256SUMS.txt`.

Manual checks not automated: real Google account approval, Windows login startup, multiple physical monitors/scaling, installer upgrade/uninstall and exclusive full-screen behavior. No signing certificate or automatic desktop update channel is configured.
