#!/usr/bin/env bash
# FlashMuse → 阿里静态镜像同步（唯一实现，2026-08-02 收敛）。
#
# 取代了原来三份互相分叉的写法：
#   - scripts/sync-flashmuse-next-static.sh（有 flock/超时/dry-run，但默认路径还是 pm2 时代的 /var/www/flashmuse）
#   - deploy/staging/sync-ali-test.sh（路径对但没有 flock/超时/partial-dir）
#   - 正式服每次手写到 /tmp/syncali.sh（重启就没，不在仓库里）
#
# 用法（⚠️ --stack 必须用等号形式，参数解析只认 `--stack=xxx`）：
#   deploy/sync-ali.sh --stack=staging [--with-generated] [--dry-run]
#   deploy/sync-ali.sh --stack=prod    [--dry-run]
#
# 内容：① 容器里构建的 .next/static（docker cp 出来再 rsync，--delete 全量对齐）
#       ② home-assets（首页 hero 素材，增量）
#       ③ generated（仅 --with-generated 时；测试服的 generated 一直靠这个脚本同步，必须带。
#          正式服不要带：21GB，正式服由应用的 ali-sync 增量同步）。
#
# ⚠️ _next/static 的 rsync --delete 构造上不原子（同步窗口内新旧 chunk 混合，用户可能
#    ChunkLoadError）。彻底消除要改成"版本目录 + 软链切换"（待办，别在这个脚本里顺手改）。
set -euo pipefail

STACK=""
WITH_GENERATED=0
DRY_RUN=0
for arg in "$@"; do
  case "$arg" in
    --stack=*) STACK="${arg#--stack=}" ;;
    --with-generated) WITH_GENERATED=1 ;;
    --dry-run) DRY_RUN=1 ;;
    *) echo "[sync-ali] unknown argument: $arg" >&2; exit 2 ;;
  esac
done

ALI_KEY=${ALI_SYNC_SSH_KEY:-/opt/flashmuse/data/runtime/flashmuse_to_ali_ed25519}
ALI=${ALI_SYNC_USER:-root}@${ALI_SYNC_HOST:-101.37.129.164}
SSHOPT="ssh -i $ALI_KEY -o StrictHostKeyChecking=no -o ConnectTimeout=10"

case "$STACK" in
  staging)
    CONTAINER="flashmuse-staging-staging-app-1"
    DEST="/var/www/flashmuse-static-test"
    HOME_ASSETS_SRC="/opt/flashmuse-staging/data/home-assets/"
    GENERATED_SRC="/opt/flashmuse-staging/data/generated/"
    ;;
  prod)
    CONTAINER="flashmuse-flashmuse-app-1"
    DEST="/var/www/flashmuse-static"
    HOME_ASSETS_SRC="/opt/flashmuse/data/home-assets/"
    GENERATED_SRC="/opt/flashmuse/data/generated/"
    ;;
  *)
    echo "[sync-ali] usage: $0 --stack=staging|prod [--with-generated] [--dry-run]" >&2
    exit 2
    ;;
esac

LOCK="/tmp/flashmuse-sync-ali-${STACK}.lock"
TMP="/tmp/sync-ali-static-${STACK}"

(
  flock -n 9 || { echo "[sync-ali] another sync for ${STACK} is running" >&2; exit 1; }

  RSYNC=(-a --partial-dir=.rsync-partial --timeout=120)
  if [ "$DRY_RUN" -eq 1 ]; then RSYNC+=(--dry-run --itemize-changes); fi

  echo "[sync-ali] ${STACK}: docker cp ${CONTAINER}:/app/.next/static -> ${TMP}"
  sudo rm -rf "$TMP"
  sudo docker cp "${CONTAINER}:/app/.next/static" "$TMP"

  echo "[sync-ali] ${STACK}: rsync _next/static -> ${ALI}:${DEST}/_next/static/"
  sudo ssh -o StrictHostKeyChecking=no -i "$ALI_KEY" "$ALI" "mkdir -p ${DEST}/_next/static ${DEST}/home-assets"
  # ⛔ 不用 --append-verify（与 --partial-dir 互斥，踩过）；--delete 只加在 _next/static 上。
  sudo rsync "${RSYNC[@]}" --delete -e "$SSHOPT" "${TMP}/" "${ALI}:${DEST}/_next/static/"

  echo "[sync-ali] ${STACK}: rsync home-assets -> ${ALI}:${DEST}/home-assets/"
  sudo rsync "${RSYNC[@]}" -e "$SSHOPT" "$HOME_ASSETS_SRC" "${ALI}:${DEST}/home-assets/"

  if [ "$WITH_GENERATED" -eq 1 ]; then
    echo "[sync-ali] ${STACK}: rsync generated -> ${ALI}:${DEST}/generated/（增量，无 --delete）"
    sudo ssh -o StrictHostKeyChecking=no -i "$ALI_KEY" "$ALI" "mkdir -p ${DEST}/generated"
    sudo rsync "${RSYNC[@]}" -e "$SSHOPT" "$GENERATED_SRC" "${ALI}:${DEST}/generated/"
  fi

  sudo rm -rf "$TMP"
  echo "[sync-ali] ${STACK}: done"
) 9>"$LOCK"
