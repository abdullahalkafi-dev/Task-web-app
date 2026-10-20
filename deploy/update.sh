#!/bin/bash
# Pulls main, rebuilds and restarts only this project's containers, then checks the site answers.
# Run on the server:  /opt/projects/task-web-app/deploy/update.sh
# Or from your PC:    ssh -p 2222 deploy@72.61.246.98 /opt/projects/task-web-app/deploy/update.sh
set -euo pipefail

cd /opt/projects/task-web-app
git pull --ff-only
docker compose up -d --build --remove-orphans
docker compose ps

echo "Waiting for the site..."
for _ in $(seq 1 20); do
  if curl -fsS -o /dev/null https://task-web-app.silverjeanscloth.com/api/health; then
    echo "OK: https://task-web-app.silverjeanscloth.com is up"
    exit 0
  fi
  sleep 3
done
echo "Site did not answer. Check: docker compose logs --tail 50 dayflow-web dayflow-api" >&2
exit 1
