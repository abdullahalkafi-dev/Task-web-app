#!/bin/bash
# Run after the verified Android backend/web support is pushed to main.
# Back up Dayflow, build before replacement, and leave the shared proxy untouched.
set -euo pipefail
umask 077
cd /opt/projects/task-web-app

test -z "$(git status --porcelain)" || { echo 'Server working tree is dirty; stopping.' >&2; exit 1; }
backup_dir="$HOME/backups/task-web-app/android-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$backup_dir"
git rev-parse HEAD > "$backup_dir/previous-commit.txt"
docker compose exec -T mongo mongodump --archive --gzip > "$backup_dir/mongo.gz"
docker compose exec -T dayflow-api tar czf - -C /app/uploads . > "$backup_dir/uploads.tgz"
cp /opt/projects/silvergym/nginx/conf.d/task-web-app.conf "$backup_dir/task-web-app.conf"
test -s "$backup_dir/mongo.gz"
test -s "$backup_dir/uploads.tgz"
(cd "$backup_dir" && sha256sum mongo.gz uploads.tgz task-web-app.conf previous-commit.txt > SHA256SUMS.txt)

git pull --ff-only origin main
docker compose build dayflow-api dayflow-web
docker compose up -d --no-build --no-deps dayflow-api dayflow-web
for attempt in $(seq 1 20); do
  if curl -fsS -o /dev/null https://task-web-app.silverjeanscloth.com/api/health &&
     curl -fsS -o /dev/null https://task-web-app.silverjeanscloth.com/login &&
     curl -fsS -o /dev/null https://task-web-app.silverjeanscloth.com/desktop/connect; then
    git rev-parse HEAD > "$backup_dir/deployed-commit.txt"
    docker compose ps
    echo "Android backend/web support deployed. Backups: $backup_dir"
    exit 0
  fi
  sleep 3
done
echo "Health check failed. Preserve the backups at $backup_dir and follow the rollback runbook." >&2
exit 1
