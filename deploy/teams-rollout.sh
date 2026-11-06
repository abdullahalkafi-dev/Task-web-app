#!/bin/bash
# Back up only Dayflow, then use its standard deployment entry point.
set -euo pipefail
umask 077
cd /opt/projects/task-web-app
test -z "$(git status --porcelain)" || { echo 'Server working tree is dirty; stopping.' >&2; exit 1; }
backup_dir="$HOME/backups/task-web-app/teams-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$backup_dir"
git rev-parse HEAD > "$backup_dir/previous-commit.txt"
docker compose exec -T mongo mongodump --archive --gzip > "$backup_dir/mongo.gz"
docker compose exec -T dayflow-api tar czf - -C /app/uploads . > "$backup_dir/uploads.tgz"
cp /opt/projects/silvergym/nginx/conf.d/task-web-app.conf "$backup_dir/task-web-app.conf"
test -s "$backup_dir/mongo.gz"
test -s "$backup_dir/uploads.tgz"
(cd "$backup_dir" && sha256sum mongo.gz uploads.tgz task-web-app.conf previous-commit.txt > SHA256SUMS.txt && sha256sum -c SHA256SUMS.txt)
echo "Dayflow backup verified: $backup_dir"
# Pull the verified deployment script. No proxy configuration or other services are changed.
git pull --ff-only origin main
DAYFLOW_EXPECTED_REVISION="${1:?Pass the verified commit SHA}" /opt/projects/task-web-app/deploy/update.sh
git rev-parse HEAD > "$backup_dir/deployed-commit.txt"
curl -fsS -o /dev/null https://task-web-app.silverjeanscloth.com/teams
curl -fsS -o /dev/null https://task-web-app.silverjeanscloth.com/desktop/connect
echo "Teams deployed. Backups: $backup_dir"
