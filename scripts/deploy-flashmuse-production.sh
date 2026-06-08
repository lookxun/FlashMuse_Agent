#!/usr/bin/env bash
set -euo pipefail

APP_ROOT=${FLASHMUSE_APP_ROOT:-/var/www/flashmuse}
PM2_APP=${FLASHMUSE_PM2_APP:-flashmuse}
SYNC_SCRIPT=${FLASHMUSE_NEXT_STATIC_SYNC_SCRIPT:-/usr/local/bin/sync-flashmuse-next-static.sh}
LOG_PREFIX="[flashmuse-deploy]"

cd "$APP_ROOT"

echo "$LOG_PREFIX running npm build"
npm run build

echo "$LOG_PREFIX restarting pm2 app: $PM2_APP"
pm2 restart "$PM2_APP" --update-env

echo "$LOG_PREFIX saving pm2 process list"
pm2 save

if [ ! -x "$SYNC_SCRIPT" ]; then
  echo "$LOG_PREFIX sync script not executable: $SYNC_SCRIPT" >&2
  exit 1
fi

echo "$LOG_PREFIX syncing _next/static to Ali"
"$SYNC_SCRIPT" --clear-cache

echo "$LOG_PREFIX done"
