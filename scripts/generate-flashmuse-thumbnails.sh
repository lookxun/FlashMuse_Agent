#!/usr/bin/env bash
set -euo pipefail

ROOT=${1:-/var/www/flashmuse-static/generated}
created=0
failed=0

[ -d "$ROOT" ] || exit 0

while IFS= read -r -d '' src; do
  rel=${src#$ROOT/}
  case "$rel" in
    *image-thumbnails/*|*videos/*|*files/*) continue ;;
  esac

  case "$rel" in
    users/*/*)
      user_id=$(printf '%s' "$rel" | cut -d/ -f2)
      rest=$(printf '%s' "$rel" | cut -d/ -f3-)
      base=${rest%.*}.jpg
      dst="$ROOT/users/$user_id/image-thumbnails/$base"
      ;;
    *)
      base=${rel%.*}.jpg
      dst="$ROOT/image-thumbnails/$base"
      ;;
  esac

  [ -f "$dst" ] && continue
  mkdir -p "$(dirname "$dst")"
  if ffmpeg -y -hide_banner -loglevel error -i "$src" -vf 'scale=256:256:force_original_aspect_ratio=decrease' -frames:v 1 -q:v 5 "$dst" >/dev/null 2>&1; then
    created=$((created + 1))
  else
    failed=$((failed + 1))
    rm -f "$dst"
  fi
done < <(find "$ROOT" -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o -iname '*.webp' -o -iname '*.bmp' -o -iname '*.gif' -o -iname '*.tif' -o -iname '*.tiff' -o -iname '*.heic' -o -iname '*.heif' \) -print0)

printf 'created=%s failed=%s\n' "$created" "$failed"
