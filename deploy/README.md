# Deploying to the shared VPS

Host layout (Ubuntu, Docker, no root needed):

- `/opt/projects/task-web-app` — this repo, `.env`, and `letsencrypt/` (this site's certificates only).
- The host's nginx container (from the `silvergym` stack) owns ports 80/443. Dayflow publishes **no host port**: its
  `dayflow-web` container joins that nginx's network (`docker-compose.vps.yml`) and nginx proxies to it by name.
- `deploy/task-web-app.conf` is copied to `/opt/projects/silvergym/nginx/conf.d/`; the cert files are written to
  `/opt/projects/silvergym/nginx/ssl/task-web-app.{fullchain,privkey}.pem`. Nothing in the other stack's files is edited.

Server `.env` (never committed): `JWT_SECRET`, `COOKIE_SECURE=true`, `SUPERADMIN_EMAILS`, `GOOGLE_CLIENT_ID`, and
`COMPOSE_FILE=docker-compose.yml:docker-compose.vps.yml`.

Update: `cd /opt/projects/task-web-app && git pull && docker compose up -d --build`.
Renewal: `deploy/renew-ssl.sh` runs from the deploy user's crontab.
