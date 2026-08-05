#!/usr/bin/env bash
# 把腾讯的 generated 媒体补齐/对齐到阿里静态镜像 —— 「目录级同步」的唯一实现（2026-08-04 新增）。
#
# 背景（🗣️ 用户：「把那个阿里没有同步到的媒体全部手动同步一下，保证两台服务器的媒体数量内容一致」）：
#   应用层的自动同步（src/lib/ali-sync.ts）原来是单流 rsync，在这条丢包 20~25% 的跨境链路上
#   **视频几乎 100% 失败**（线上 aliSynced 成功 43 / 失败 79）。2026-08-04 首次统计：
#   腾讯 21318 个文件 / 21.20GB，阿里 20303 个 / 20.10GB，**缺 1248 个 / 1.16GB**
#   （其中视频 138 个占 1110MB = 95% 的缺失字节）。
#
# 机制：复用 deploy/ali-parallel-pull.sh（阿里侧 16 并发分片拉取，实测 461KB/s）。
#   ⛔ 别在这里再写一份分片逻辑 —— 见 AGENTS.md「能统一一律统一」。
#
# 用法（在腾讯上跑）：
#   sudo bash /opt/flashmuse/app/scripts/backfill-ali-media.sh --stack=prod [--dry-run] [--limit=N] [--batch=N]
#   sudo bash /opt/flashmuse-staging/app/scripts/backfill-ali-media.sh --stack=staging [--dry-run]
#
# 特性：
#   - **幂等可重跑**：阿里侧「大小+md5 一致就跳过」，中断后再跑只补剩下的。
#   - **分批**：默认每批 200 个文件一次 SSH（握手 4~12 秒，别按文件建连接），批间打印进度。
#   - **flock 单实例**：避免两个补数据任务互相抢带宽把速度拉垮。
#   - 全程日志落 `.runtime/transfer-diagnostics-log.jsonl`（和应用层同一个文件，便于统一分析）。
#
# ⚠️ 首次全量补 1.16GB 按 461KB/s 约需 **40~60 分钟**，建议 nohup 后台跑：
#   sudo nohup bash .../backfill-ali-media.sh --stack=prod > /tmp/backfill-ali.log 2>&1 &

set -uo pipefail

STACK=""; DRY_RUN=0; LIMIT=0; BATCH=200
for arg in "$@"; do
  case "$arg" in
    --stack=*) STACK="${arg#--stack=}" ;;
    --dry-run) DRY_RUN=1 ;;
    --limit=*) LIMIT="${arg#--limit=}" ;;
    --batch=*) BATCH="${arg#--batch=}" ;;
    *) echo "[backfill] unknown argument: $arg" >&2; exit 2 ;;
  esac
done

case "$STACK" in
  prod)
    ROOT=/opt/flashmuse
    GENERATED_SRC=/opt/flashmuse/data/generated
    DEST_ROOT_DEFAULT=/var/www/flashmuse-static/generated
    PULL_BASE_DEFAULT=http://119.28.116.16:5000/generated
    ;;
  staging)
    ROOT=/opt/flashmuse-staging
    GENERATED_SRC=/opt/flashmuse-staging/data/generated
    DEST_ROOT_DEFAULT=/var/www/flashmuse-static-test/generated
    PULL_BASE_DEFAULT=http://119.28.116.16:5001/generated
    ;;
  *)
    echo "[backfill] usage: $0 --stack=prod|staging [--dry-run] [--limit=N] [--batch=N]" >&2
    exit 2
    ;;
esac

ENV_FILE="$ROOT/data/.env.local"
PULLER="$ROOT/app/deploy/ali-parallel-pull.sh"
RUNTIME_DIR="$ROOT/data/runtime"
TRANSFER_LOG="$RUNTIME_DIR/transfer-diagnostics-log.jsonl"

# 从该栈的 .env.local 读同步配置（和应用用同一份，避免两处漂移）
read_env() {
  ENV_KEY="$1"; ENV_DEFAULT="${2:-}"
  ENV_VALUE=$(grep -oE "^${ENV_KEY}=.*" "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"'"'"'\r')
  [ -z "$ENV_VALUE" ] && ENV_VALUE="$ENV_DEFAULT"
  printf '%s' "$ENV_VALUE"
}

ALI_HOST=$(read_env ALI_SYNC_HOST 101.37.129.164)
ALI_USER=$(read_env ALI_SYNC_USER root)
ALI_PORT=$(read_env ALI_SYNC_PORT 22)
ALI_KEY=$(read_env ALI_SYNC_SSH_KEY "$RUNTIME_DIR/flashmuse_to_ali_ed25519")
DEST_ROOT=$(read_env ALI_SYNC_DEST_ROOT "$DEST_ROOT_DEFAULT")
PULL_BASE=$(read_env ALI_SYNC_PULL_BASE_URL "$PULL_BASE_DEFAULT")
CONC=$(read_env ALI_SYNC_CONCURRENCY 16)
CHUNK=$(read_env ALI_SYNC_CHUNK_BYTES 1048576)

# ⚠️ 容器里的 key 路径是 /app/.runtime/...，宿主机上要换成真实路径
case "$ALI_KEY" in
  /app/.runtime/*) ALI_KEY="$RUNTIME_DIR/${ALI_KEY#/app/.runtime/}" ;;
esac

echo "[backfill] stack=$STACK"
echo "[backfill]   源目录   : $GENERATED_SRC"
echo "[backfill]   阿里目标 : $ALI_USER@$ALI_HOST:$DEST_ROOT"
echo "[backfill]   拉取基址 : $PULL_BASE"
echo "[backfill]   并发/分片: $CONC / $CHUNK 字节   批大小: $BATCH"
[ "$DRY_RUN" -eq 1 ] && echo "[backfill]   ** DRY RUN：只比对不传输 **"

[ -d "$GENERATED_SRC" ] || { echo "[backfill] 源目录不存在: $GENERATED_SRC" >&2; exit 1; }
[ -f "$PULLER" ] || { echo "[backfill] 拉取器脚本不存在: $PULLER" >&2; exit 1; }
[ -f "$ALI_KEY" ] || { echo "[backfill] 同步密钥不存在: $ALI_KEY" >&2; exit 1; }

SSHOPT=(-i "$ALI_KEY" -p "$ALI_PORT" -o BatchMode=yes -o StrictHostKeyChecking=no -o ConnectTimeout=30 -o ServerAliveInterval=15)
TARGET="$ALI_USER@$ALI_HOST"

LOCK="/tmp/flashmuse-backfill-ali-${STACK}.lock"
exec 9>"$LOCK"
flock -n 9 || { echo "[backfill] 另一个 $STACK 补数据任务正在跑（$LOCK）" >&2; exit 1; }

WORK=$(mktemp -d /tmp/fm-backfill.XXXXXX)
trap 'rm -rf "$WORK"' EXIT INT TERM

echo "[backfill] 1/4 统计腾讯侧清单 ..."
( cd "$GENERATED_SRC" && find . -type f ! -name '*.fmpart.*' -printf '%P|%s\n' 2>/dev/null ) | sort > "$WORK/local.list"
LOCAL_N=$(wc -l < "$WORK/local.list")
LOCAL_B=$(awk -F'|' '{s+=$2} END{print s+0}' "$WORK/local.list")
printf '[backfill]   腾讯: %s 个文件 / %.2f GB\n' "$LOCAL_N" "$(echo "scale=4; $LOCAL_B/1073741824" | bc)"

echo "[backfill] 2/4 统计阿里侧清单 ..."
ssh "${SSHOPT[@]}" "$TARGET" "mkdir -p '$DEST_ROOT' && cd '$DEST_ROOT' && find . -type f ! -name '*.fmpart.*' -printf '%P|%s\n' 2>/dev/null" | sort > "$WORK/remote.list" || {
  echo "[backfill] 读取阿里清单失败" >&2; exit 1
}
REMOTE_N=$(wc -l < "$WORK/remote.list")
REMOTE_B=$(awk -F'|' '{s+=$2} END{print s+0}' "$WORK/remote.list")
printf '[backfill]   阿里: %s 个文件 / %.2f GB\n' "$REMOTE_N" "$(echo "scale=4; $REMOTE_B/1073741824" | bc)"

echo "[backfill] 3/4 计算差异（腾讯有而阿里缺、或大小不一致）..."
comm -23 "$WORK/local.list" "$WORK/remote.list" > "$WORK/diff.list"
DIFF_N=$(wc -l < "$WORK/diff.list")
DIFF_B=$(awk -F'|' '{s+=$2} END{print s+0}' "$WORK/diff.list")
printf '[backfill]   需要传: %s 个 / %.2f GB\n' "$DIFF_N" "$(echo "scale=4; $DIFF_B/1073741824" | bc)"
awk -F'|' '{n=$1; if(n~/\/videos\//)t="视频"; else if(n~/video-posters/)t="视频封面"; else if(n~/thumbnails/)t="缩略图"; else if(n~/\/images\//)t="图片"; else if(n~/\/files\//)t="文件"; else t="其它"; c[t]++; b[t]+=$2} END{for(k in c) printf "[backfill]     %-8s %6d 个  %9.2f MB\n", k, c[k], b[k]/1048576}' "$WORK/diff.list"

# 反向提示（阿里有而腾讯没有）：⛔ 绝不自动删除，只报数给人看
comm -13 "$WORK/local.list" "$WORK/remote.list" > "$WORK/extra.list"
EXTRA_N=$(wc -l < "$WORK/extra.list")
[ "$EXTRA_N" -gt 0 ] && echo "[backfill]   ⚠️ 阿里多出 $EXTRA_N 个条目（本脚本不删，需人工确认；可能是旧的压缩前版本）"

if [ "$DIFF_N" -eq 0 ]; then
  echo "[backfill] ✅ 两端已一致，无需传输。"
  exit 0
fi

if [ "$LIMIT" -gt 0 ] && [ "$DIFF_N" -gt "$LIMIT" ]; then
  head -n "$LIMIT" "$WORK/diff.list" > "$WORK/diff.limited"
  mv "$WORK/diff.limited" "$WORK/diff.list"
  DIFF_N=$LIMIT
  echo "[backfill]   --limit=$LIMIT → 本次只传前 $LIMIT 个"
fi

if [ "$DRY_RUN" -eq 1 ]; then
  echo "[backfill] DRY RUN 结束。最大的 10 个待传文件："
  sort -t'|' -k2 -rn "$WORK/diff.list" | head -10 | awk -F'|' '{printf "[backfill]   %8.2f MB  %s\n", $2/1048576, $1}'
  exit 0
fi

echo "[backfill] 4/4 计算 md5 并分批传输（每批 $BATCH 个）..."
# md5 只对「要传的那些」算（1.16GB 本地算很快），阿里侧用它做跳过判断和拼装后校验。
: > "$WORK/manifest.all"
while IFS='|' read -r REL SIZE; do
  [ -z "${REL:-}" ] && continue
  MD5=$(md5sum "$GENERATED_SRC/$REL" 2>/dev/null | cut -d' ' -f1)
  printf '%s|%s|%s\n' "$REL" "$SIZE" "$MD5" >> "$WORK/manifest.all"
done < "$WORK/diff.list"

split -l "$BATCH" -d -a 4 "$WORK/manifest.all" "$WORK/batch."
BATCHES=$(ls "$WORK"/batch.* 2>/dev/null | wc -l)
echo "[backfill]   共 $BATCHES 批"

RUN_STARTED=$(date +%s)
TOTAL_OK=0; TOTAL_SKIP=0; TOTAL_FAIL=0; TOTAL_BYTES=0; BATCH_I=0

for BATCH_FILE in "$WORK"/batch.*; do
  BATCH_I=$(( BATCH_I + 1 ))
  B64=$(base64 -w0 < "$BATCH_FILE")
  BATCH_STARTED=$(date +%s)

  {
    printf 'FM_PULL_BASE=%q\n' "$PULL_BASE"
    printf 'FM_DEST_ROOT=%q\n' "$DEST_ROOT"
    printf 'FM_MANIFEST_B64=%q\n' "$B64"
    printf 'FM_CONCURRENCY=%q\n' "$CONC"
    printf 'FM_CHUNK_BYTES=%q\n' "$CHUNK"
    echo 'export FM_PULL_BASE FM_DEST_ROOT FM_MANIFEST_B64 FM_CONCURRENCY FM_CHUNK_BYTES'
    cat "$PULLER"
  } | ssh "${SSHOPT[@]}" "$TARGET" "bash -s" > "$WORK/out.$BATCH_I" 2>"$WORK/err.$BATCH_I"

  # 逐行落传输日志（和应用层同一个 jsonl，字段名对齐，便于一起分析）
  # ⛔⛔ 本脚本以 root 跑，若由它**首次创建**这个文件，所有者会是 root，
  #   而容器里的 app 以 uid 1000(node) 身份运行 → 之后 app 追加会失败并被静默吞掉
  #   （2026-08-04 实测踩到：同步明明成功，但传输日志一条应用侧记录都没有）。
  #   → 每批都确保文件属主是 1000:1000（和 data/runtime 下其它诊断日志一致）。
  if [ -d "$RUNTIME_DIR" ]; then
    awk -v ts="$(date -u +%Y-%m-%dT%H:%M:%S.000Z)" -v ep="$(date +%s000)" -v st="$STACK" \
      '/^\{/ { sub(/^\{/, "{\"ts\":\"" ts "\",\"tsEpochMs\":" ep ",\"source\":\"backfill\",\"stack\":\"" st "\","); print }' \
      "$WORK/out.$BATCH_I" >> "$TRANSFER_LOG" 2>/dev/null || true
    chown 1000:1000 "$TRANSFER_LOG" 2>/dev/null || true
  fi

  SUM=$(grep -o '"event":"ali-pull-summary".*' "$WORK/out.$BATCH_I" | tail -1)
  B_OK=$(printf '%s' "$SUM" | grep -oE '"ok":[0-9]+' | head -1 | cut -d: -f2); B_OK=${B_OK:-0}
  B_SKIP=$(printf '%s' "$SUM" | grep -oE '"skipped":[0-9]+' | head -1 | cut -d: -f2); B_SKIP=${B_SKIP:-0}
  B_FAIL=$(printf '%s' "$SUM" | grep -oE '"failed":[0-9]+' | head -1 | cut -d: -f2); B_FAIL=${B_FAIL:-0}
  B_BYTES=$(printf '%s' "$SUM" | grep -oE '"bytes":[0-9]+' | head -1 | cut -d: -f2); B_BYTES=${B_BYTES:-0}
  B_KBPS=$(printf '%s' "$SUM" | grep -oE '"kbps":[0-9.]+' | head -1 | cut -d: -f2); B_KBPS=${B_KBPS:-0}

  TOTAL_OK=$(( TOTAL_OK + B_OK )); TOTAL_SKIP=$(( TOTAL_SKIP + B_SKIP ))
  TOTAL_FAIL=$(( TOTAL_FAIL + B_FAIL )); TOTAL_BYTES=$(( TOTAL_BYTES + B_BYTES ))
  BATCH_ELAPSED=$(( $(date +%s) - BATCH_STARTED ))
  ELAPSED=$(( $(date +%s) - RUN_STARTED ))

  printf '[backfill]   批 %s/%s: 传成功 %s 跳过 %s 失败 %s | %.1f MB | %ss | %s KB/s | 累计 %.2f GB / %sm\n' \
    "$BATCH_I" "$BATCHES" "$B_OK" "$B_SKIP" "$B_FAIL" \
    "$(echo "scale=2; $B_BYTES/1048576" | bc)" "$BATCH_ELAPSED" "$B_KBPS" \
    "$(echo "scale=3; $TOTAL_BYTES/1073741824" | bc)" "$(( ELAPSED / 60 ))"

  if [ "$B_FAIL" -gt 0 ]; then
    echo "[backfill]     失败明细（前 3 条）："
    grep '"ok":false' "$WORK/out.$BATCH_I" | head -3 | sed 's/^/[backfill]       /'
  fi
done

RUN_ELAPSED=$(( $(date +%s) - RUN_STARTED ))
echo ""
echo "[backfill] ===== 完成 ====="
printf '[backfill]   传成功 %s / 跳过 %s / 失败 %s\n' "$TOTAL_OK" "$TOTAL_SKIP" "$TOTAL_FAIL"
printf '[backfill]   传输 %.2f GB，耗时 %s 分 %s 秒，平均 %s KB/s\n' \
  "$(echo "scale=3; $TOTAL_BYTES/1073741824" | bc)" "$(( RUN_ELAPSED / 60 ))" "$(( RUN_ELAPSED % 60 ))" \
  "$(echo "scale=1; $TOTAL_BYTES/${RUN_ELAPSED:-1}/1024" | bc)"

if [ "$TOTAL_FAIL" -gt 0 ]; then
  echo "[backfill]   ⚠️ 有 $TOTAL_FAIL 个失败 —— **直接重跑本脚本即可**（幂等，已传好的会跳过）。"
  exit 1
fi
echo "[backfill]   ✅ 全部成功。建议再跑一次 --dry-run 确认两端一致。"
