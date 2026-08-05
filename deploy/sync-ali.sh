#!/usr/bin/env bash
# FlashMuse → 阿里静态镜像同步（唯一实现，2026-08-02 收敛；2026-08-04 改为并发传输）。
#
# 取代了原来三份互相分叉的写法：
#   - scripts/sync-flashmuse-next-static.sh（有 flock/超时/dry-run，但默认路径还是 pm2 时代的 /var/www/flashmuse）
#   - deploy/staging/sync-ali-test.sh（路径对但没有 flock/超时/partial-dir）
#   - 正式服每次手写到 /tmp/syncali.sh（重启就没，不在仓库里）
#
# ⭐⭐ 2026-08-04：所有「腾讯 → 阿里」的文件传输改成并发（🗣️ 用户拍板「全走 8 并发」）。
#   实测这条跨境链路 RTT 278ms、**丢包 20~25%**，单流被拥塞控制压死只有 15~30 KB/s；
#   并发实测 4→147 / 8→357 / **16→461** / 32→329 KB/s。所以：
#     - `_next/static` 和 `home-assets`（大量小文件）→ **分桶并发 rsync**（8 桶），
#       最后再跑一次单流 `--delete` 对齐（⚠️ --delete 绝不能放进分桶里，见下面注释）。
#     - `generated`（含 20MB 大视频）→ 交给 `scripts/backfill-ali-media.sh`，
#       它用 `deploy/ali-parallel-pull.sh` 做**按分片并发**（分桶只能并发到「文件」粒度，
#       治不了单个大文件；这也是原来视频 100% 同步失败的原因）。
#
# 用法（⚠️ --stack 必须用等号形式，参数解析只认 `--stack=xxx`）：
#   deploy/sync-ali.sh --stack=staging [--with-generated] [--dry-run]
#   deploy/sync-ali.sh --stack=prod    [--with-generated] [--dry-run]
#
# 内容：① 容器里构建的 .next/static（docker cp 出来再 rsync，--delete 全量对齐）
#       ② home-assets（首页 hero 素材，增量）
#       ③ generated（仅 --with-generated 时；测试服的 generated 一直靠这个脚本同步，必须带。
#          正式服平时不用带 —— 应用的 ali-sync 会实时增量同步；要补历史缺口直接跑 backfill 脚本）。
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
SSHOPT="ssh -i $ALI_KEY -o StrictHostKeyChecking=no -o ConnectTimeout=30 -o ServerAliveInterval=15"
# 实测最优并发 16；⛔ 别调到 32（反而更慢）。小文件分桶用 8 就够（桶数=SSH 连接数）。
BUCKETS=${ALI_SYNC_BUCKETS:-8}

case "$STACK" in
  staging)
    CONTAINER="flashmuse-staging-staging-app-1"
    DEST="/var/www/flashmuse-static-test"
    HOME_ASSETS_SRC="/opt/flashmuse-staging/data/home-assets/"
    BACKFILL="/opt/flashmuse-staging/app/scripts/backfill-ali-media.sh"
    ;;
  prod)
    CONTAINER="flashmuse-flashmuse-app-1"
    DEST="/var/www/flashmuse-static"
    HOME_ASSETS_SRC="/opt/flashmuse/data/home-assets/"
    BACKFILL="/opt/flashmuse/app/scripts/backfill-ali-media.sh"
    ;;
  *)
    echo "[sync-ali] usage: $0 --stack=staging|prod [--with-generated] [--dry-run]" >&2
    exit 2
    ;;
esac

LOCK="/tmp/flashmuse-sync-ali-${STACK}.lock"
TMP="/tmp/sync-ali-static-${STACK}"

# 分桶并发 rsync：把文件清单轮转分成 N 份，每份一个 rsync 进程（= N 次 SSH 握手，
# ⚠️ 这条链路握手要 4~12 秒，所以是「分桶」而不是「每文件一个连接」）。
# ⛔ 绝不在分桶里加 --delete：每个桶只看得见自己那份清单，会把别的桶的文件当成"多余的"删掉。
parallel_rsync() {
  PR_SRC="$1"
  PR_DEST="$2"
  PR_LABEL="$3"
  if [ ! -d "$PR_SRC" ]; then
    echo "[sync-ali] ${STACK}: ${PR_LABEL} 源目录不存在，跳过：$PR_SRC"
    return 0
  fi
  PR_WORK=$(mktemp -d "/tmp/fm-syncali-${STACK}.XXXXXX")
  ( cd "$PR_SRC" && find . -type f -printf '%P\n' 2>/dev/null ) | sort > "$PR_WORK/all.list"
  PR_N=$(wc -l < "$PR_WORK/all.list")
  if [ "$PR_N" -eq 0 ]; then
    echo "[sync-ali] ${STACK}: ${PR_LABEL} 没有文件，跳过"
    rm -rf "$PR_WORK"; return 0
  fi
  echo "[sync-ali] ${STACK}: ${PR_LABEL} $PR_N 个文件，分 $BUCKETS 桶并发传输"
  awk -v n="$BUCKETS" -v d="$PR_WORK" '{ print > (d "/bucket." (NR % n)) }' "$PR_WORK/all.list"

  PR_PIDS=""
  for PR_B in "$PR_WORK"/bucket.*; do
    [ -f "$PR_B" ] || continue
    sudo rsync "${RSYNC[@]}" --files-from="$PR_B" -e "$SSHOPT" "$PR_SRC/" "${ALI}:${PR_DEST}/" &
    PR_PIDS="$PR_PIDS $!"
  done
  PR_RC=0
  for PR_PID in $PR_PIDS; do
    wait "$PR_PID" || PR_RC=1
  done
  rm -rf "$PR_WORK"
  if [ "$PR_RC" -ne 0 ]; then
    echo "[sync-ali] ${STACK}: ⚠️ ${PR_LABEL} 有桶失败，改用单流 rsync 兜底补一次" >&2
    sudo rsync "${RSYNC[@]}" -e "$SSHOPT" "$PR_SRC/" "${ALI}:${PR_DEST}/"
  fi
  return 0
}

(
  flock -n 9 || { echo "[sync-ali] another sync for ${STACK} is running" >&2; exit 1; }

  RSYNC=(-a --partial-dir=.rsync-partial --timeout=300)
  if [ "$DRY_RUN" -eq 1 ]; then RSYNC+=(--dry-run --itemize-changes); fi

  echo "[sync-ali] ${STACK}: docker cp ${CONTAINER}:/app/.next/static -> ${TMP}"
  sudo rm -rf "$TMP"
  sudo docker cp "${CONTAINER}:/app/.next/static" "$TMP"

  sudo ssh -o StrictHostKeyChecking=no -i "$ALI_KEY" "$ALI" "mkdir -p ${DEST}/_next/static ${DEST}/home-assets"

  # ① _next/static：先分桶并发把内容传齐，再单流跑一次 --delete 对齐（此时几乎没有数据要传，很快）
  parallel_rsync "$TMP" "${DEST}/_next/static" "_next/static"
  echo "[sync-ali] ${STACK}: rsync --delete 对齐 _next/static（清理旧 chunk）"
  sudo rsync "${RSYNC[@]}" --delete -e "$SSHOPT" "${TMP}/" "${ALI}:${DEST}/_next/static/"

  # ② home-assets：增量，无 --delete
  parallel_rsync "${HOME_ASSETS_SRC%/}" "${DEST}/home-assets" "home-assets"

  # ③ generated：交给 backfill 脚本（按分片并发，能治大视频）
  if [ "$WITH_GENERATED" -eq 1 ]; then
    if [ -f "$BACKFILL" ]; then
      echo "[sync-ali] ${STACK}: generated → 交给 backfill-ali-media.sh（分片并发）"
      BACKFILL_ARGS="--stack=${STACK}"
      [ "$DRY_RUN" -eq 1 ] && BACKFILL_ARGS="$BACKFILL_ARGS --dry-run"
      sudo bash "$BACKFILL" $BACKFILL_ARGS || echo "[sync-ali] ${STACK}: ⚠️ generated 同步有失败，重跑 backfill 脚本即可（幂等）" >&2
    else
      echo "[sync-ali] ${STACK}: ⚠️ 找不到 $BACKFILL，generated 未同步" >&2
    fi
  fi

  sudo rm -rf "$TMP"
  echo "[sync-ali] ${STACK}: done"
) 9>"$LOCK"
