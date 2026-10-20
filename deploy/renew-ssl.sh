#!/bin/bash
# Renews the Let's Encrypt certificate for Dayflow and reloads the shared nginx. Needs no sudo (uses docker).
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

LIVE="${LE_DIR}/live/${DOMAIN}"
if ! cmp -s "${LIVE}/fullchain.pem" "${NGINX_DIR}/ssl/task-web-app.fullchain.pem"; then
  cp "${LIVE}/fullchain.pem" "${NGINX_DIR}/ssl/task-web-app.fullchain.pem"
  cp "${LIVE}/privkey.pem" "${NGINX_DIR}/ssl/task-web-app.privkey.pem"
  chmod 600 "${NGINX_DIR}/ssl/task-web-app.privkey.pem"
  docker exec silvergym-nginx nginx -t
  docker exec silvergym-nginx nginx -s reload
  echo "${STAMP} certificate renewed and nginx reloaded"
else
  echo "${STAMP} certificate unchanged"
fi
