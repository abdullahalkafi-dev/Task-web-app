# Dayflow desktop for Windows

Windows 11 x64 companion to the website, maintained in this repository. Each person uses their own existing Dayflow account. The installer contains no account or task data and needs no local server, MongoDB or Docker.

## Installation and controls

Install `Dayflow-Setup-1.0.0-x64.exe`. Connect to the internet and choose **Sign in with your browser**. In your usual browser, sign into Google, compare the six-digit code with the desktop app, and approve the connection. Return to Dayflow.

The initial private installer is unsigned. Windows may identify an unknown publisher. Share the installer and SHA-256 checksum through a trusted channel. Code signing and public distribution are deferred.

| Control | Behavior |
| --- | --- |
| Bubble | Click to open; drag to reposition; right-click for menu |
| Expand / compact | Switch presentation while retaining the current editor |
| Pin | Keep the compact panel above ordinary windows |
| Ctrl+Alt+D | Show/hide; configurable in Desktop settings |
| Escape | Dismiss an open dialog first, otherwise collapse |
| Window close | Finish local saving, then return to bubble/tray |
| Tray > Quit Dayflow | Finish local saving and exit completely |

Start with Windows is opt-in. Hide the bubble in settings or the tray. Clicking another application leaves the panel open. The bubble is hidden while the workspace is open. Windows security screens and exclusive full-screen applications are outside the overlay guarantee.

## Offline and sync

First setup requires internet. After successful sync and interface caching, previously loaded tasks/notes reopen offline. Edits and queued images upload on reconnection. Desktop settings reports offline readiness; images never loaded previously may require internet.

Browser and desktop have independent local storage and cookies. They exchange changes through the server. **Saved on this device** describes local note persistence; the sync pill describes server acknowledgement. Live notifications normally synchronize connected, awake clients within five seconds. Polling and resume/visibility sync recover missed notifications. Suspended processes catch up on resume.

Conflicts retain document-level last-write-wins. An older saved task draft is restored for review with a notice rather than silently discarded.

## Code ownership and development

- Frontend: shared tasks/notes/editors, compact presentation, offline storage and sync. `lib/desktop-contract.ts` owns the versioned bridge interface.
- Backend: existing data APIs, expiring desktop handoffs, and user-scoped notifications.
- Desktop: Electron lifecycle, windows, preferences, auth client, isolated preloads, local bubble/fallback assets, tests and installer.

Never duplicate task/note data logic in Electron. Its dependency on the frontend bridge is types-only. Package installations, lockfiles and Docker contexts remain independent.

Use Node 24 on Windows:

```powershell
npm --prefix backend ci
npm --prefix frontend ci
npm --prefix desktop ci
```

Start the existing web/backend development servers, then:

```powershell
$env:DAYFLOW_DEV_URL = 'http://localhost:3000'
npm run desktop:dev
```

Only unpackaged builds accept a loopback HTTP development origin; otherwise the deployed website opens. `DAYFLOW_USER_DATA` optionally isolates a test profile. The development launcher removes inherited `ELECTRON_RUN_AS_NODE`.

## Verification and installer

```powershell
npm run check
npm --prefix backend run build
npm --prefix frontend run build
npm --prefix desktop run test:e2e
npm --prefix frontend run e2e
npm run desktop:dist
npm --prefix desktop run test:packaged
Get-FileHash desktop/release/Dayflow-Setup-1.0.0-x64.exe -Algorithm SHA256
```

The desktop integration suite starts the throwaway test stack, stubs Google, launches real Electron, and captures compact/expanded screenshots. Production never accepts the fake credentials. See the desktop implementation checklist for recorded results and unrun manual checks.

The packaged smoke check uses an isolated `--user-data-dir` profile and verifies the deployed sign-in screen without signing into a personal account.

Send only the installer and checksum to friends. Desktop updates use a newer installer with the same application identity. Bump the desktop manifest and lockfile version together. Upgrades/uninstall preserve local app data by default, including unsynced edits; data removal is a separate deliberate action.

Keep application ID `com.dayflow.desktop`, product name `Dayflow`, and session partition `persist:dayflow` stable. They identify the existing Windows profile, cookies, IndexedDB and service-worker cache. Packaged builds load only the fixed production origin. No credentials or `.env` file are packaged.

Hosted interface updates use normal website deployment and service-worker caching. Do not force reload while editing. New native features require a new installer. Bridge v1 evolves additively, with feature detection; the website always works without a bridge.

## Native security and authentication

Google authentication opens in the default browser. The main process generates a random verifier; the backend stores its SHA-256 challenge in a five-minute MongoDB request. Explicit browser approval binds an account to that request; only the initiating desktop process can exchange it, once. No JWT is put in a URL. The frontend imports the normal session and `/auth/me` restores its image cookie.

Hosted pages have no Node integration. Sandboxed, context-isolated preloads expose only typed operations. IPC checks the exact origin and top frame and validates inputs. Embedded popups, foreign navigation, webviews, downloads and permissions are blocked; HTTPS external links open in the browser. The local bubble has a separate restricted bridge.

Before hiding, mode changes and quit, the main process waits for registered editor writes to finish in IndexedDB. A timeout or failure keeps the workspace available for recovery. No network is needed for this boundary. Abrupt OS termination remains subject to ordinary autosave timing.

## Deployment and rollback

Deploy the shared frontend/backend changes **before sharing the installer**. Follow the existing shared-VPS runbook. Existing task/note schemas do not change; MongoDB creates a TTL-indexed `desktoprequests` collection automatically.

The SSE route must stream without buffering through Next.js and nginx. Apply this project's nginx config, run `nginx -t`, then reload gracefully. Verify a real Google handoff and two-client edit after deployment. Polling alone does not prove streaming works.

`deploy/desktop-rollout.sh` creates private MongoDB/uploads/proxy backups, records the previous commit, pulls main, builds before replacing Dayflow's containers, validates this site's proxy update, reloads nginx and checks health. Execute the updated script without first changing the server checkout if the recorded commit must identify the previously deployed version.

The notification bus assumes one backend process; additional replicas require shared pub/sub. Handoffs persist in MongoDB until expiry. Website rollback must remain compatible with installed bridge v1 clients. Retain a previous installer for desktop rollback and never delete local profiles or database volumes during rollback.

## Troubleshooting

| Problem | Action |
| --- | --- |
| Desktop sign-in unavailable | Confirm internet and deploy the desktop auth endpoints |
| Code expired/already used | Start again from the desktop app |
| Shortcut unavailable | Choose a different shortcut in settings |
| Bubble missing | Open tray, enable bubble, check monitors |
| First launch offline | Connect once and complete offline setup |
| Updates arrive only after polling | Check `/api/sync/events`, proxy buffering and heartbeats |
| Expired session with pending edits | Sign into the same account; the outbox is retained |
| Cannot collapse/quit | Resolve local storage/save errors and retry |

Manual release checks include installer upgrade/uninstall, real Google sign-in, shortcut conflicts, Windows login startup, multiple monitors/scaling, and a fully disconnected cold start. Do not describe an unrun manual check as passed.
