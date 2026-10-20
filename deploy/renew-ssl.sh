#!/bin/bash
# Renews the Let's Encrypt certificate for Dayflow and reloads the shared nginx. Needs no sudo (uses docker, because
# certbot's files are owned by root).
# crontab: 17 3,15 * * * /opt/projects/task-web-app/deploy/renew-ssl.sh >> /opt/projects/task-web-app/ssl-renew.log 2>&1
set -euo pipefail

DOMAIN="task-web-app.silverjeanscloth.com"
APP_DIR="/opt/projects/task-web-app"
LE_DIR="${APP_DIR}/letsencrypt"
NGINX_DIR="/opt/projects/silvergym/nginx"
STAMP="[$(date '+%Y-%m-%d %H:%M:%S')]"

docker run --rm \
  -v "${NGINX_DIR}/certbot:/var/www/certbot" \
  -v "${LE_DIR}:/etc/letsencrypt" \
  certbot/certbot renew --webroot -w /var/www/certbot --quiet --no-self-upgrade

# Copy the live cert into the nginx ssl folder when it differs; prints CHANGED if it did.
RESULT=$(docker run --rm --entrypoint sh \
  -v "${LE_DIR}:/le:ro" \
  -v "${NGINX_DIR}/ssl:/out" \
  certbot/certbot -c "
    if ! cmp -s /le/live/${DOMAIN}/fullchain.pem /out/task-web-app.fullchain.pem; then
      cp /le/live/${DOMAIN}/fullchain.pem /out/task-web-app.fullchain.pem
      cp /le/live/${DOMAIN}/privkey.pem /out/task-web-app.privkey.pem
      chown 1000:1000 /out/task-web-app.fullchain.pem /out/task-web-app.privkey.pem
      chmod 600 /out/task-web-app.privkey.pem
      echo CHANGED
    fi")

if [ "${RESULT}" = "CHANGED" ]; then
  docker exec silvergym-nginx nginx -t
  docker exec silvergym-nginx nginx -s reload
  echo "${STAMP} certificate renewed and nginx reloaded"
else
  echo "${STAMP} certificate unchanged"
fi
