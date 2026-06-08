#!/usr/bin/env bash
set -euo pipefail

APP_ROOT=${FLASHMUSE_APP_ROOT:-/var/www/flashmuse}
SOURCE_DIR=${FLASHMUSE_NEXT_STATIC_SOURCE:-$APP_ROOT/.next/static/}
ALI_HOST=${ALI_SYNC_HOST:-101.37.129.164}
ALI_USER=${ALI_SYNC_USER:-root}
ALI_PORT=${ALI_SYNC_PORT:-22}
ALI_SSH_KEY=${ALI_SYNC_SSH_KEY:-/root/.ssh/flashmuse_to_ali_ed25519}
ALI_DEST=${ALI_NEXT_STATIC_DEST:-/var/www/flashmuse-static/_next/static/}
LOCK_FILE=${FLASHMUSE_NEXT_STATIC_LOCK:-/tmp/flashmuse-next-static-sync.lock}
LOG_PREFIX="[flashmuse-next-static-sync]"

dry_run=0
clear_cache=0

for arg in "$@"; do
  case "$arg" in
    --dry-run) dry_run=1 ;;
    --clear-cache) clear_cache=1 ;;
    *)
      echo "$LOG_PREFIX unknown argument: $arg" >&2
      exit 2
      ;;
  esac
done

if [ ! -d "$SOURCE_DIR" ]; then
  echo "$LOG_PREFIX source directory not found: $SOURCE_DIR" >&2
  exit 1
fi

if [ ! -f "$ALI_SSH_KEY" ]; then
  echo "$LOG_PREFIX ssh key not found: $ALI_SSH_KEY" >&2
  exit 1
fi

mkdir -p "$(dirname "$LOCK_FILE")"

rsync_args=(-az --delete --partial --timeout=60)
if [ "$dry_run" -eq 1 ]; then
  rsync_args+=(--dry-run --itemize-changes)
fi

ssh_cmd="ssh -i $ALI_SSH_KEY -p $ALI_PORT -o StrictHostKeyChecking=no -o ConnectTimeout=10"

(
  flock -n 9 || {
    echo "$LOG_PREFIX another sync is running" >&2
    exit 1
  }

  echo "$LOG_PREFIX syncing $SOURCE_DIR -> $ALI_USER@$ALI_HOST:$ALI_DEST"
  rsync "${rsync_args[@]}" -e "$ssh_cmd" "$SOURCE_DIR" "$ALI_USER@$ALI_HOST:$ALI_DEST"

  if [ "$clear_cache" -eq 1 ] && [ "$dry_run" -eq 0 ]; then
    echo "$LOG_PREFIX clearing Ali nginx cache"
    $ssh_cmd "$ALI_USER@$ALI_HOST" "rm -rf /var/cache/nginx/flashmuse_static/* && nginx -t && systemctl reload nginx"
  fi

  echo "$LOG_PREFIX done"
) 9>"$LOCK_FILE"
