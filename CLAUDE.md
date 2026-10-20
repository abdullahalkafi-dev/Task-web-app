# Dayflow (Task_Web_App)

Next.js 15 frontend (`frontend/`) + Express/Mongoose backend (`backend/`) + MongoDB, run with Docker Compose.
Google sign-in only. Super Admins (emails in `SUPERADMIN_EMAILS`) get a User Management page with counts only.

- Backend modules: `backend/src/modules/<name>/{interface,model,validation,service,controller,route,test}`.
- Frontend: `frontend/src/{app,components,hooks,lib}`; offline-first (Dexie plus an outbox, synced via `/api/sync`).
- Images are files under `<UPLOAD_DIR>/<userId>/`, served by an authenticated route; not stored in MongoDB.
- Checks: `npm run typecheck && npm run lint && npm test` in each of `backend/` and `frontend/`.
  E2E: build both, then `npm run e2e` in `frontend/` (Google is faked in `frontend/e2e/stub-google.mjs`).

## Deploying
Live at https://task-web-app.silverjeanscloth.com on a **shared VPS** (`ssh -p 2222 deploy@72.61.246.98`).
Push to `main`, then run `/opt/projects/task-web-app/deploy/update.sh` on the server.
Read `deploy/README.md` before touching anything on the server. Key rules:
- Keep the compose service names `dayflow-web` and `dayflow-api` (silvergym shares the network and has `frontend`/`backend`).
- Do not edit silvergym's files or containers. Our only files in its nginx folder are `task-web-app.conf` and `task-web-app.*.pem`.
- Run `docker exec silvergym-nginx nginx -t` before any nginx reload. Never use `docker compose down -v`.
- Never commit `.env`; server secrets live only in `/opt/projects/task-web-app/.env`.
