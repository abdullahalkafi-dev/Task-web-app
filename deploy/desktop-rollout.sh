#!/bin/bash
# Run only after the tested desktop changes are pushed to this repository's main branch.
# Touches Dayflow's own containers and its explicitly named config on the shared proxy.
set -euo pipefail
umask 077
cd /opt/projects/task-web-app
test -z "$(git status --porcelain)" || { echo 'Server working tree is dirty; stopping.' >&2; exit 1; }
backup_dir="$HOME/backups/task-web-app/desktop-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$backup_dir"
git rev-parse HEAD > "$backup_dir/previous-commit.txt"
docker compose exec -T mongo mongodump --archive --gzip > "$backup_dir/mongo.gz"
docker compose exec -T dayflow-api tar czf - -C /app/uploads . > "$backup_dir/uploads.tgz"
cp /opt/projects/silvergym/nginx/conf.d/task-web-app.conf "$backup_dir/task-web-app.conf"
test -s "$backup_dir/mongo.gz"
test -s "$backup_dir/uploads.tgz"
git pull --ff-only origin main
# Build all images before replacing the running application.
docker compose build dayflow-api dayflow-web
docker compose up -d --no-build dayflow-api dayflow-web
cp deploy/task-web-app.conf /opt/projects/silvergym/nginx/conf.d/task-web-app.conf
if ! docker exec silvergym-nginx nginx -t; then
  cp "$backup_dir/task-web-app.conf" /opt/projects/silvergym/nginx/conf.d/task-web-app.conf
  echo 'Proxy validation failed; restored previous Dayflow configuration.' >&2
  exit 1
fi
docker exec silvergym-nginx nginx -s reload
for attempt in $(seq 1 20); do
  if curl -fsS -o /dev/null https://task-web-app.silverjeanscloth.com/api/health && curl -fsS -o /dev/null https://task-web-app.silverjeanscloth.com/desktop/connect; then
    docker compose ps
    echo "Desktop support deployed. Backups: $backup_dir"
    exit 0
  fi
  sleep 3
done
echo 'Health check failed; inspect the Dayflow containers and roll back using the saved commit.' >&2
exit 1
