# Dayflow: deployment runbook

Live site: https://task-web-app.silverjeanscloth.com
Repo: https://github.com/abdullahalkafi-dev/Task-web-app (public, branch `main`)

## Everyday workflow

### Desktop companion rollout

Deploy frontend/backend desktop support before sharing the Windows installer. The release adds `/api/auth/desktop/*`, `/desktop/connect` and `/api/sync/events`, with a five-minute TTL collection and no task/note schema migration. Node 24 is used by the container builds.

Apply the updated Dayflow nginx configuration with buffering disabled for streaming. Follow the existing shared-server rules: validate nginx before graceful reload and do not alter the other project's configuration. Verify the live sign-in handoff and a two-client task/note update. This change assumes one backend process for notifications. Installer creation and manual desktop upgrades are documented in [Desktop guide](../docs/DESKTOP.md).

### Standard web deployment

```bash
# 1. On your PC: change code, then check it
cd backend  && npm run typecheck && npm run lint && npm test
cd frontend && npm run typecheck && npm run lint && npm test

# 2. Push
git add -A && git commit -m "what changed" && git push

# 3. Deploy (one command from your PC)
ssh -p 2222 deploy@72.61.246.98 /opt/projects/task-web-app/deploy/update.sh
```

`update.sh` pulls `main`, rebuilds, restarts only this project's containers and checks that the site answers. The
Docker build runs typecheck and lint first, so a broken change fails the build and the running site stays up.

## Where things live on the server

| What | Where |
|---|---|
| App folder | `/opt/projects/task-web-app` |
| Secrets and settings | `/opt/projects/task-web-app/.env` (not in git, mode 600) |
| Containers | `task-web-app-dayflow-web-1`, `-dayflow-api-1`, `-mongo-1` |
| Data volumes | `task-web-app_mongo_data` (records), `task-web-app_uploads_data` (images) |
| nginx config for this site | `/opt/projects/silvergym/nginx/conf.d/task-web-app.conf` (source: `deploy/task-web-app.conf`) |
| TLS files nginx uses | `/opt/projects/silvergym/nginx/ssl/task-web-app.{fullchain,privkey}.pem` |
| Certificate store | `/opt/projects/task-web-app/letsencrypt` (root-owned, git-ignored) |
| Renewal | `deploy/renew-ssl.sh` from the `deploy` user's crontab, twice a day, log: `ssl-renew.log` |

The server also runs another project (**silvergym**). Its nginx container owns ports 80 and 443 and terminates HTTPS
for both sites. Dayflow publishes **no host port**: the `dayflow-web` container joins silvergym's Docker network
(`docker-compose.vps.yml`) and nginx proxies to it by name.

## Rules that keep the two projects from breaking each other

1. **Keep the service names `dayflow-web` and `dayflow-api`.** `dayflow-web` shares a network with silvergym, which
   already has services called `frontend` and `backend`. A generic name resolves to the wrong container (this caused a
   500 error once).
2. **Never edit silvergym's own files or containers.** Only `task-web-app.conf` and the `task-web-app.*.pem` files are
   ours inside its nginx folder.
3. **Test nginx before reloading**: `docker exec silvergym-nginx nginx -t && docker exec silvergym-nginx nginx -s reload`.
   The reload is graceful. Our config resolves the upstream at request time, so a stopped Dayflow can never stop
   nginx from starting.
4. **Don't publish host ports** and don't use `docker compose down -v` (it deletes the data volumes).

## `.env` on the server

| Variable | Meaning |
|---|---|
| `JWT_SECRET` | long random string; changing it signs everyone out |
| `GOOGLE_CLIENT_ID` | OAuth Web client ID (public value, no secret needed) |
| `SUPERADMIN_EMAILS` | comma-separated Google emails that become Super Admin when they sign in |
| `COOKIE_SECURE` | `true` (the site is HTTPS only) |
| `UPLOAD_MAX_MB`, `TZ` | image size limit, timezone (`Asia/Dhaka`) |
| `COMPOSE_FILE` | `docker-compose.yml:docker-compose.vps.yml`, so plain `docker compose` commands work |

After editing `.env`: `cd /opt/projects/task-web-app && docker compose up -d` (no rebuild needed).

## Common tasks

**Add or remove a Super Admin**: edit `SUPERADMIN_EMAILS` and restart (above). The person must sign in once to be
promoted. To demote someone, edit their user document, because the env var only promotes:
```bash
docker compose exec mongo mongosh dayflow --eval 'db.users.updateOne({email:"x@gmail.com"},{$set:{role:"user"}})'
```

**See logs / status**
```bash
cd /opt/projects/task-web-app
docker compose ps
docker compose logs --tail 100 -f dayflow-api      # or dayflow-web
```

**Roll back a bad deploy**
```bash
cd /opt/projects/task-web-app
git log --oneline | head              # pick the last good commit
git checkout <commit> && docker compose up -d --build
# when fixed on main: git checkout main && git pull
```

**New domain or extra Google origin**: add it to the Client ID's *Authorized JavaScript origins* in Google Cloud
Console. For a new domain also copy and edit `deploy/task-web-app.conf` and request a certificate like `renew-ssl.sh`.

## Backups (do this before risky changes)

Records are in MongoDB and images are **files on disk** (`/app/uploads/<userId>/...`), so back up both.
```bash
cd /opt/projects/task-web-app && mkdir -p ~/backups/task-web-app && D=$(date +%F)
docker compose exec -T mongo mongodump --archive --gzip > ~/backups/task-web-app/mongo-$D.gz
docker run --rm -v task-web-app_uploads_data:/data -v ~/backups/task-web-app:/backup alpine \
  tar czf /backup/uploads-$D.tgz -C /data .
```
Restore: `docker compose exec -T mongo mongorestore --archive --gzip --drop < mongo-DATE.gz`, and untar the uploads
archive into the `task-web-app_uploads_data` volume. Deleting a note or task does not delete its image files yet.

## Troubleshooting

| Symptom | Check |
|---|---|
| Site shows 502/504 | `docker compose ps`; `docker compose logs --tail 50 dayflow-web dayflow-api` |
| `/api/...` returns 500 | `docker exec silvergym-nginx wget -qO- http://dayflow-web:3000/api/health`; check the service names |
| Google button missing, "not set up" text | `GOOGLE_CLIENT_ID` empty in `.env`, then `docker compose up -d` |
| Google error `origin_mismatch` | site URL missing from Authorized JavaScript origins |
| Google "access blocked" | consent screen still in Testing, so publish it |
| Browser warns about the certificate | `./deploy/renew-ssl.sh`; `tail ssl-renew.log` |
| Build fails on the server | the typecheck or lint gate failed; fix locally and push |
