#!/usr/bin/env bash
# 腾讯 → 阿里 媒体同步的「阿里侧并发分片拉取器」——唯一实现（2026-08-04 新增）。
#
# 为什么要它（实测数据，⛔ 别再退回单流 rsync）：
#   腾讯新加坡 ↔ 阿里杭州这条跨境链路 RTT 278ms、**丢包 20~25%**，单条 TCP 被拥塞控制压死：
#     单流     15~30 KB/s   → 18.8MB 视频要 10 分钟以上，而代码里 rsync 超时是 120s = 100% 失败
#     4 并发      147 KB/s
#     8 并发      357 KB/s
#     16 并发     461 KB/s   ← 最优（本脚本默认）
#     32 并发     329 KB/s   → 反而更差（并发过高互相挤），⛔ 别往上调
#   ⭐ 丢包才是真凶、不是延迟：阿里→BytePlus RTT 398ms 比腾讯的 278ms 还高，
#     但 0 丢包就能跑 752KB/s。所以解法是「多流绕开单流拥塞控制」，不是「换个协议」。
#
# 机制：阿里侧用 curl 的 Range 请求并发拉腾讯 nginx 上的 /generated 静态文件。
#   ⭐ 两条路都要，否则总有一种场景吃不满并发（2026-08-04 首版只做了后者，实测踩到）：
#     ① **小文件（<=256KB）→ 跨文件并发**：整文件一个任务，941 个小缩略图一把并发拉完。
#        （只做分片并发的话，小文件每个只有 1 片 = 单流，941 个就退化成串行）
#     ② **大文件（>256KB）→ 分片并发 + 自适应片大小**：片大小 = ceil(size/并发数)，
#        夹在 [256KB, FM_CHUNK_BYTES] 之间，保证**任何大小的文件都能切出 ~并发数 个片**。
#        （固定 1MB 片时，2.72MB 的文件只切 3 片 = 只用到 3 个并发，实测只有 44KB/s）
#
# 调用方（⛔ 两个调用方共用本文件，别再复制第二份 —— 见 AGENTS.md「能统一一律统一」）：
#   1. src/lib/ali-sync.ts            —— 每次生成媒体后自动同步
#   2. scripts/backfill-ali-media.sh  —— 手动补齐历史漏掉的
# 调用方式：把「变量赋值行 + 本文件内容」拼成 payload 从 stdin 喂给 `ssh ali bash -s`。
#   ⚠️ 一次 SSH 握手就够：这条链路 SSH 握手实测要 4~12 秒，**绝不能按文件逐个建连接**。
#
# 入参（调用方以前置变量赋值传入）：
#   FM_PULL_BASE     必填  腾讯侧可被阿里访问的 generated 基地址，如 http://119.28.116.16:5000/generated
#   FM_DEST_ROOT     必填  阿里侧落地根目录，如 /var/www/flashmuse-static/generated
#   FM_MANIFEST_B64  必填  base64 的清单，每行 `相对路径|字节数|md5`（md5 允许为空）
#   FM_CONCURRENCY   选填  默认 16（实测最优，⛔ 别调到 32）
#   FM_CHUNK_BYTES   选填  默认 1048576（1MB）——「片大小上限」，实际片大小自适应变小
#   FM_CHUNK_RETRY   选填  默认 3（单片失败只重传该片，不重传整个文件）
#   FM_CHUNK_TIMEOUT 选填  默认 120（单片 curl 超时秒数）
#   FM_SMALL_BYTES   选填  默认 262144（<=256KB 走「跨文件并发」那条路）
#
# 输出：stdout **每个文件一行 JSON**，最后一行 summary（调用方解析后落传输日志）。
#   ⛔ 进度/诊断一律写 stderr，别污染 stdout 的 JSON 流。
# 退出码：全部成功 0；有任何文件失败 1；入参缺失 2。

set -uo pipefail

FM_CONC="${FM_CONCURRENCY:-16}"
FM_CHUNK="${FM_CHUNK_BYTES:-1048576}"
FM_RETRY="${FM_CHUNK_RETRY:-3}"
FM_TIMEOUT="${FM_CHUNK_TIMEOUT:-120}"
FM_SMALL="${FM_SMALL_BYTES:-262144}"

if [ -z "${FM_PULL_BASE:-}" ] || [ -z "${FM_DEST_ROOT:-}" ] || [ -z "${FM_MANIFEST_B64:-}" ]; then
  echo '{"event":"ali-pull-fatal","error":"missing FM_PULL_BASE / FM_DEST_ROOT / FM_MANIFEST_B64"}'
  exit 2
fi

for dep in curl base64 md5sum stat xargs bc; do
  command -v "$dep" >/dev/null 2>&1 || { echo "{\"event\":\"ali-pull-fatal\",\"error\":\"missing dependency: $dep\"}"; exit 2; }
done

WORK="$(mktemp -d /tmp/fm-alipull.XXXXXX)" || { echo '{"event":"ali-pull-fatal","error":"mktemp failed"}'; exit 2; }
# ⭐ 任何退出路径都清临时目录：丢包链路重试多，攒下的分片会把 /tmp 撑爆。
trap 'rm -rf "$WORK"' EXIT INT TERM

MANIFEST="$WORK/manifest"
printf '%s' "$FM_MANIFEST_B64" | base64 -d > "$MANIFEST" 2>/dev/null || {
  echo '{"event":"ali-pull-fatal","error":"manifest base64 decode failed"}'
  exit 2
}

# JSON 字符串转义（路径里可能有引号/反斜杠/中文 —— 用户上传的文件名会进 files/ 目录）。
json_escape() {
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' | tr -d '\r\n'
}

# ---- 公共：判断目标是否已经一致（幂等，补数据脚本要反复重跑）----
# 返回 0 = 已一致可跳过
fm_already_ok() {
  local dest="$1" size="$2" md5="$3" have
  [ -f "$dest" ] || return 1
  have=$(stat -c%s "$dest" 2>/dev/null || echo 0)
  [ "$have" = "$size" ] || return 1
  [ -z "$md5" ] && return 0
  [ "$(md5sum "$dest" 2>/dev/null | cut -d' ' -f1)" = "$md5" ]
}
export -f fm_already_ok

# ---- 公共：原子落地（同分区 mv，用户绝不会读到半截文件）----
fm_install() {
  local tmp="$1" dest="$2" stage
  mkdir -p "$(dirname "$dest")" 2>/dev/null
  stage="$dest.fmpart.$$"
  if mv -f "$tmp" "$stage" 2>/dev/null && mv -f "$stage" "$dest" 2>/dev/null; then
    chmod 644 "$dest" 2>/dev/null
    return 0
  fi
  rm -f "$stage"
  return 1
}
export -f fm_install

# ---- 路径 ① 小文件：整文件一个任务，**跨文件并发** ----
# 参数经 "$1" 传入（制表符分隔：rel \t size \t md5 \t outdir \t taskid）
# ⛔ 并发写 stdout 会把 JSON 串行化搞乱 → 每个任务把 JSON 写到自己的文件，主进程最后按序 cat。
fm_fetch_whole() {
  local line="$1"
  local rel size md5 outdir taskid dest tmp started elapsed ms got try kbps
  IFS=$'\t' read -r rel size md5 outdir taskid <<< "$line"
  dest="$FM_DEST_ROOT/$rel"
  started=$(date +%s.%N)

  if fm_already_ok "$dest" "$size" "$md5"; then
    printf '{"event":"ali-pull-file","rel":"%s","bytes":%s,"skipped":true,"reason":"same-content","ok":true}\n' \
      "$(printf '%s' "$rel" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g')" "$size" > "$outdir/json.$taskid"
    return 0
  fi

  tmp="$outdir/blob.$taskid"
  try=0
  while [ "$try" -lt "$FM_RETRY" ]; do
    try=$(( try + 1 ))
    if curl -sfS --max-time "$FM_TIMEOUT" -o "$tmp" "$FM_PULL_BASE/$rel" 2>/dev/null; then
      got=$(stat -c%s "$tmp" 2>/dev/null || echo 0)
      if [ "$got" = "$size" ] && { [ -z "$md5" ] || [ "$(md5sum "$tmp" 2>/dev/null | cut -d' ' -f1)" = "$md5" ]; }; then
        elapsed=$(echo "$(date +%s.%N) - $started" | bc)
        ms=$(echo "$elapsed*1000" | bc)
        kbps=$(echo "scale=1; $got / $elapsed / 1024" | bc 2>/dev/null || echo 0)
        if fm_install "$tmp" "$dest"; then
          printf '{"event":"ali-pull-file","rel":"%s","bytes":%s,"chunks":1,"retries":%s,"ms":%.0f,"kbps":%s,"conc":%s,"mode":"whole","ok":true}\n' \
            "$(printf '%s' "$rel" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g')" "$size" "$(( try - 1 ))" "$ms" "${kbps:-0}" "$FM_CONC" > "$outdir/json.$taskid"
          return 0
        fi
        printf '{"event":"ali-pull-file","rel":"%s","bytes":%s,"ms":%.0f,"ok":false,"error":"move into place failed"}\n' \
          "$(printf '%s' "$rel" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g')" "$size" "$ms" > "$outdir/json.$taskid"
        touch "$outdir/failed.$taskid"
        return 1
      fi
    fi
    rm -f "$tmp"
    sleep 1
  done
  elapsed=$(echo "$(date +%s.%N) - $started" | bc)
  printf '{"event":"ali-pull-file","rel":"%s","bytes":%s,"retries":%s,"ms":%.0f,"ok":false,"error":"whole-file fetch failed"}\n' \
    "$(printf '%s' "$rel" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g')" "$size" "$(( try - 1 ))" "$(echo "$elapsed*1000" | bc)" > "$outdir/json.$taskid"
  touch "$outdir/failed.$taskid"
  return 1
}
export -f fm_fetch_whole

# ---- 路径 ② 大文件的单个分片（由 xargs 并发调用）----
fm_fetch_chunk() {
  local line="$1"
  local rel idx start end dir out want got try
  IFS=$'\t' read -r rel idx start end dir <<< "$line"
  out="$dir/part.$idx"
  want=$(( end - start + 1 ))
  try=0
  while [ "$try" -lt "$FM_RETRY" ]; do
    try=$(( try + 1 ))
    if curl -sfS --max-time "$FM_TIMEOUT" -r "${start}-${end}" -o "$out" "$FM_PULL_BASE/$rel" 2>/dev/null; then
      got=$(stat -c%s "$out" 2>/dev/null || echo 0)
      # ⚠️ 必须校验分片字节数：丢包链路上 curl 可能提前结束却仍返回成功。
      if [ "$got" = "$want" ]; then
        echo "$try" > "$dir/tries.$idx"
        return 0
      fi
    fi
    rm -f "$out"
    sleep 1
  done
  echo "$try" > "$dir/tries.$idx"
  touch "$dir/failed.$idx"
  return 1
}
export -f fm_fetch_chunk
export FM_PULL_BASE FM_DEST_ROOT FM_RETRY FM_TIMEOUT FM_CONC

TOTAL=0; OK_N=0; FAIL_N=0; SKIP_N=0; OK_BYTES=0
RUN_STARTED=$(date +%s.%N)

# ================= 分流：小文件 / 大文件 =================
SMALL_TASKS="$WORK/small.tasks"
LARGE_LIST="$WORK/large.list"
: > "$SMALL_TASKS"; : > "$LARGE_LIST"
SMALL_OUT="$WORK/smallout"; mkdir -p "$SMALL_OUT"
TASK_ID=0

while IFS='|' read -r REL SIZE MD5 || [ -n "${REL:-}" ]; do
  [ -z "${REL:-}" ] && continue
  # ⛔ 防路径穿越：带 .. 或绝对路径的一律拒绝（清单是本地生成的，但多一道不亏）。
  case "$REL" in
    /*|*..*) continue ;;
  esac
  TOTAL=$(( TOTAL + 1 ))
  SIZE="${SIZE:-0}"; MD5="${MD5:-}"
  case "$SIZE" in ''|*[!0-9]*) SIZE=0 ;; esac

  if [ "$SIZE" -le "$FM_SMALL" ]; then
    TASK_ID=$(( TASK_ID + 1 ))
    printf '%s\t%s\t%s\t%s\t%s\n' "$REL" "$SIZE" "$MD5" "$SMALL_OUT" "$TASK_ID" >> "$SMALL_TASKS"
  else
    printf '%s|%s|%s\n' "$REL" "$SIZE" "$MD5" >> "$LARGE_LIST"
  fi
done < "$MANIFEST"

# ---------- 阶段 1：小文件跨文件并发 ----------
if [ -s "$SMALL_TASKS" ]; then
  echo "[ali-pull] 小文件 $(wc -l < "$SMALL_TASKS") 个，跨文件并发 $FM_CONC" >&2
  xargs -a "$SMALL_TASKS" -d '\n' -P "$FM_CONC" -n 1 \
    bash -c 'fm_fetch_whole "$1"' _ >/dev/null 2>&1 || true
  # 按 taskid 顺序输出 JSON，并累计统计
  I=1
  while [ "$I" -le "$TASK_ID" ]; do
    if [ -f "$SMALL_OUT/json.$I" ]; then
      cat "$SMALL_OUT/json.$I"
      if grep -q '"ok":false' "$SMALL_OUT/json.$I"; then
        FAIL_N=$(( FAIL_N + 1 ))
      elif grep -q '"skipped":true' "$SMALL_OUT/json.$I"; then
        SKIP_N=$(( SKIP_N + 1 ))
      else
        OK_N=$(( OK_N + 1 ))
        SB=$(grep -oE '"bytes":[0-9]+' "$SMALL_OUT/json.$I" | head -1 | cut -d: -f2)
        OK_BYTES=$(( OK_BYTES + ${SB:-0} ))
      fi
    fi
    I=$(( I + 1 ))
  done
  rm -rf "$SMALL_OUT"
fi

# ---------- 阶段 2：大文件逐个处理，片大小自适应吃满并发 ----------
while IFS='|' read -r REL SIZE MD5 || [ -n "${REL:-}" ]; do
  [ -z "${REL:-}" ] && continue
  DEST="$FM_DEST_ROOT/$REL"
  STARTED=$(date +%s.%N)

  if fm_already_ok "$DEST" "$SIZE" "$MD5"; then
    SKIP_N=$(( SKIP_N + 1 ))
    printf '{"event":"ali-pull-file","rel":"%s","bytes":%s,"skipped":true,"reason":"same-content","ok":true}\n' "$(json_escape "$REL")" "$SIZE"
    continue
  fi

  SLOT="$WORK/$(printf '%s' "$REL" | md5sum | cut -d' ' -f1)"
  rm -rf "$SLOT"; mkdir -p "$SLOT"

  # ⭐ 自适应片大小：让片数 ≈ 并发数，下限 256KB、上限 FM_CHUNK_BYTES。
  #   固定 1MB 时 2.72MB 的文件只切 3 片（实测只有 44KB/s）；自适应后能切 11 片吃满并发。
  ADAPTIVE=$(( (SIZE + FM_CONC - 1) / FM_CONC ))
  [ "$ADAPTIVE" -lt 262144 ] && ADAPTIVE=262144
  [ "$ADAPTIVE" -gt "$FM_CHUNK" ] && ADAPTIVE="$FM_CHUNK"

  NCHUNK=$(( (SIZE + ADAPTIVE - 1) / ADAPTIVE ))
  : > "$SLOT/tasks"
  i=0
  while [ "$i" -lt "$NCHUNK" ]; do
    A=$(( i * ADAPTIVE )); B=$(( A + ADAPTIVE - 1 ))
    [ "$B" -ge "$SIZE" ] && B=$(( SIZE - 1 ))
    printf '%s\t%s\t%s\t%s\t%s\n' "$REL" "$i" "$A" "$B" "$SLOT" >> "$SLOT/tasks"
    i=$(( i + 1 ))
  done

  # ⚠️ 用 -a 从文件读任务，绝不能让 xargs 去读 stdin —— 那是外层 while 的清单，会被吃掉。
  xargs -a "$SLOT/tasks" -d '\n' -P "$FM_CONC" -n 1 \
    bash -c 'fm_fetch_chunk "$1"' _ >/dev/null 2>&1 || true

  TRIES=$(cat "$SLOT"/tries.* 2>/dev/null | awk '{s+=$1} END{print s+0}')
  RETRIED=$(( TRIES > NCHUNK ? TRIES - NCHUNK : 0 ))

  if ls "$SLOT"/failed.* >/dev/null 2>&1; then
    NFAILED=$(ls "$SLOT"/failed.* 2>/dev/null | wc -l)
    FAIL_N=$(( FAIL_N + 1 ))
    MS=$(echo "($(date +%s.%N) - $STARTED)*1000" | bc)
    printf '{"event":"ali-pull-file","rel":"%s","bytes":%s,"chunks":%s,"failedChunks":%s,"retries":%s,"ms":%.0f,"ok":false,"error":"chunk fetch failed"}\n' \
      "$(json_escape "$REL")" "$SIZE" "$NCHUNK" "$NFAILED" "$RETRIED" "$MS"
    rm -rf "$SLOT"; continue
  fi

  TMP="$SLOT/assembled"
  : > "$TMP"
  i=0
  while [ "$i" -lt "$NCHUNK" ]; do
    cat "$SLOT/part.$i" >> "$TMP" 2>/dev/null
    i=$(( i + 1 ))
  done
  GOT=$(stat -c%s "$TMP" 2>/dev/null || echo 0)
  ELAPSED=$(echo "$(date +%s.%N) - $STARTED" | bc)
  MS=$(echo "$ELAPSED*1000" | bc)

  if [ "$GOT" != "$SIZE" ]; then
    FAIL_N=$(( FAIL_N + 1 ))
    printf '{"event":"ali-pull-file","rel":"%s","bytes":%s,"got":%s,"chunks":%s,"retries":%s,"ms":%.0f,"ok":false,"error":"size mismatch after assemble"}\n' \
      "$(json_escape "$REL")" "$SIZE" "$GOT" "$NCHUNK" "$RETRIED" "$MS"
    rm -rf "$SLOT"; continue
  fi
  if [ -n "$MD5" ] && [ "$(md5sum "$TMP" 2>/dev/null | cut -d' ' -f1)" != "$MD5" ]; then
    FAIL_N=$(( FAIL_N + 1 ))
    printf '{"event":"ali-pull-file","rel":"%s","bytes":%s,"chunks":%s,"retries":%s,"ms":%.0f,"ok":false,"error":"md5 mismatch"}\n' \
      "$(json_escape "$REL")" "$SIZE" "$NCHUNK" "$RETRIED" "$MS"
    rm -rf "$SLOT"; continue
  fi

  if fm_install "$TMP" "$DEST"; then
    OK_N=$(( OK_N + 1 )); OK_BYTES=$(( OK_BYTES + GOT ))
    KBPS=$(echo "scale=1; $GOT / $ELAPSED / 1024" | bc 2>/dev/null || echo 0)
    printf '{"event":"ali-pull-file","rel":"%s","bytes":%s,"chunks":%s,"chunkBytes":%s,"retries":%s,"ms":%.0f,"kbps":%s,"conc":%s,"mode":"chunked","ok":true}\n' \
      "$(json_escape "$REL")" "$SIZE" "$NCHUNK" "$ADAPTIVE" "$RETRIED" "$MS" "${KBPS:-0}" "$FM_CONC"
  else
    FAIL_N=$(( FAIL_N + 1 ))
    printf '{"event":"ali-pull-file","rel":"%s","bytes":%s,"ms":%.0f,"ok":false,"error":"move into place failed"}\n' \
      "$(json_escape "$REL")" "$SIZE" "$MS"
  fi
  rm -rf "$SLOT"
done < "$LARGE_LIST"

RUN_ELAPSED=$(echo "$(date +%s.%N) - $RUN_STARTED" | bc)
TOTAL_KBPS=$(echo "scale=1; $OK_BYTES / $RUN_ELAPSED / 1024" | bc 2>/dev/null || echo 0)
printf '{"event":"ali-pull-summary","total":%s,"ok":%s,"skipped":%s,"failed":%s,"bytes":%s,"ms":%.0f,"kbps":%s,"conc":%s,"chunkBytes":%s,"smallBytes":%s}\n' \
  "$TOTAL" "$OK_N" "$SKIP_N" "$FAIL_N" "$OK_BYTES" "$(echo "$RUN_ELAPSED*1000" | bc)" "${TOTAL_KBPS:-0}" "$FM_CONC" "$FM_CHUNK" "$FM_SMALL"

[ "$FAIL_N" -eq 0 ]
