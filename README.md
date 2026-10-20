# Dayflow

A calm, offline-first, multi-user app for **daily tasks** and **permanent notes**. Next.js + Express + MongoDB, packaged with Docker. All dates and times use **Asia/Dhaka (UTC+6)**.

- **Today's tasks** — one board per Dhaka day (Not Started / Started / Completed), drag to reorder or change status. At midnight Dhaka time the board starts empty; unfinished tasks never carry over, they live in **History**, from where you can **Copy to Today**.
- **Notes** — permanent, reorderable, rich text with images.
- **Works offline** — everything is saved on the device first and syncs automatically.
- **Multi-user, Google sign-in** — anyone signs in with their Google account and gets a private space; nobody else can see their data. Super Admins also get a **User Management** page with counts only (users, last login, tasks / notes / images per user).

## Quick start

```bash
cp .env.example .env        # then set JWT_SECRET, GOOGLE_CLIENT_ID and SUPERADMIN_EMAILS
docker compose up -d --build
# open http://localhost:3000
```

Only the frontend port (`APP_PORT`, default 3000) is published, and only on `127.0.0.1`, so put a reverse proxy (nginx/Caddy) with HTTPS in front of it for a public site. Next.js proxies `/api/*` and `/uploads/*` to the backend, so there is a single origin and no CORS.

### Google sign-in

There are no passwords. In Google Cloud Console, create **APIs & Services → Credentials → OAuth client ID → Web application**, add your site (for example `https://task-web-app.silverjeanscloth.com` and `http://localhost:3000`) under **Authorized JavaScript origins**, leave redirect URIs empty, and publish the consent screen to *In production*. Put the client ID in `.env` as `GOOGLE_CLIENT_ID` (it is public, no secret is needed) and restart the backend: `docker compose up -d`.

### Super Admins

Super Admins are not seeded. Put one or more Google emails in `SUPERADMIN_EMAILS` (comma-separated); they become Super Admin when they sign in. You can also set `role: "superadmin"` on a user document directly in MongoDB. The role is checked against the database on every admin call, so changes apply immediately. Super Admins see **User Management** in the rail (or the *Me* sheet on mobile).

## How offline sync works

1. **IndexedDB is the source of truth for the UI.** Every read comes from Dexie (one database per user, `dayflow_<userId>`); every write goes to Dexie first and adds an entry to an **outbox**.
2. When online, the sync engine runs on app start, on the `online` event, every 30 s, ~1 s after a local write and when the tab becomes visible. One tab syncs at a time (Web Locks); other tabs are told via `BroadcastChannel`.
3. A cycle is: **upload queued images** (and rewrite their `blob:` URLs in the HTML) → **push** the outbox in batches of 100 → **pull** everything changed since the last pull.
4. **Conflicts: last-write-wins** per document by `updatedAt`. The server returns the winner; the client adopts it.
5. Nothing is removed locally until the server acknowledges it. Failures retry with exponential backoff (1 s → 60 s). A 401 keeps all local data and asks you to sign in again.
6. Deleted items are **tombstones** (`deletedAt`) so deletions sync; the server purges tombstones older than 30 days.
7. The top-bar pill shows **Synced / Syncing… / Offline · N pending / Sync error**.
8. The app is a PWA (Serwist service worker): `/`, `/history` and `/login` open offline, uploaded images are cached, and after one online sign-in the app opens straight into the cached session.

Signing in for the first time needs internet.

### Auth transport

`POST /api/auth/google` returns the JWT in the JSON body **and** sets an httpOnly cookie. The client sends the JWT as `Authorization: Bearer …` on every API call; the cookie exists only so plain `<img src="/uploads/…">` works. For CSRF safety the cookie is accepted **only on safe `GET` requests**; every write needs the `Authorization` header. Set `COOKIE_SECURE=true` when serving over HTTPS.

## Backups

Records and images live in two named volumes: `mongo_data` and `uploads_data` (they survive `docker compose down` and rebuilds). Images are files on disk (`/app/uploads/<userId>/…`), not in MongoDB, so back up both.

```bash
# MongoDB data
docker run --rm -v task-web-app_mongo_data:/data -v $(pwd):/backup alpine tar czf /backup/mongo.tgz /data
# Uploaded images
docker run --rm -v task-web-app_uploads_data:/data -v $(pwd):/backup alpine tar czf /backup/uploads.tgz /data
```

(Volume names are prefixed with the compose project name, `task-web-app`; check with `docker volume ls`.) For a consistent MongoDB snapshot stop the stack first or use `mongodump`.

## Development

```bash
# backend (needs a MongoDB, e.g. MONGO_URI=mongodb://localhost:27017/dayflow)
cd backend && npm ci && npm run dev
# frontend
cd frontend && npm ci && BACKEND_URL=http://localhost:4000 npm run dev
```

### Quality gates

Both packages use strict TypeScript (no `any`, no `@ts-ignore`), and the Docker builds run the gate before compiling:

```bash
npm run typecheck   # tsc --noEmit (frontend also checks the service worker)
npm run lint        # @typescript-eslint: no-explicit-any, ban-ts-comment = error
```

### Tests

```bash
cd backend && npm test            # Vitest + supertest + mongodb-memory-server, one file per module
cd frontend && npm test           # Vitest: Dhaka date logic, ordering math, LWW merge, sync engine
cd frontend && npm run build      # (with BACKEND_URL=http://localhost:4000) then:
cd frontend && npm run e2e        # Playwright: offline→online, image via cookie, CSRF, DnD, a11y, responsive…  (Google is faked in e2e: see frontend/e2e/stub-google.mjs)
```

Backend tests use `mongodb-memory-server`, whose binaries do not run on Alpine (musl), so run them on the host or in CI, not inside the Alpine image. The Playwright suite starts its own throwaway stack (`frontend/e2e/stack.mjs`; backend must be built with `npm run build` first) and needs `npx playwright install chromium` once.

### Project layout

```
backend/src/modules/<name>/   interface · model · validation · service · controller · route · test
backend/src/{middleware,utils,config,routes}
frontend/src/{app,components,hooks,lib}
docs/                         ARCHITECTURE · DATABASE_SCHEMA · API_SPEC · IMPLEMENTATION_PLAN
references/                   the visual reference images
```

`/dev/ui` is a hidden page that shows every UI primitive (compare it with `references/`).
