#!/bin/bash
# Pulls main, rebuilds and restarts only this project's containers, then checks the site answers.
# Run on the server:  /opt/projects/task-web-app/deploy/update.sh
# Or from your PC:    ssh -p 2222 deploy@72.61.246.98 /opt/projects/task-web-app/deploy/update.sh
set -euo pipefail

cd /opt/projects/task-web-app
git pull --ff-only
if [ -n "${DAYFLOW_EXPECTED_REVISION:-}" ]; then
  test "$(git rev-parse HEAD)" = "$DAYFLOW_EXPECTED_REVISION" || { echo 'Unexpected server revision; stopping before build.' >&2; exit 1; }
fi
# Build both images before replacing either service. Keep MongoDB and other projects running.
docker compose build dayflow-api dayflow-web
docker compose up -d --no-build --no-deps dayflow-api dayflow-web
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
