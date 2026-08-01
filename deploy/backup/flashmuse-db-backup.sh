#!/bin/bash
#
# FlashMuse 数据库备份（正式服 + 测试服）
# ============================================================================
# 为什么必须有（2026-08-02）：在此之前**整个项目没有任何数据库备份** ——
# 没有 pg_dump、没有 cron、没有 WAL 归档。数据在单盘单实例的
# `/opt/flashmuse/data/pgdata` 上，而 `/opt/flashmuse/app-backups/` 里备份的
# 只是**应用代码**（那个 git 里本来就有，是最不值钱的东西）。
# 盘一坏或手一抖，用户、积分、账单流水、全部媒体一起没。
#
# 设计原则（改这个脚本前必读）：
#   1. ⛔ **绝不碰生产数据。** 对数据库只做 pg_dump（只读）；只往 $BACKUP_ROOT 写；
#      删文件只删**本脚本自己命名规则**匹配的那些。
#   2. ⭐ **备份完必须验证**。最经典的事故是"天天备份成功、真要恢复时发现是空文件"。
#      所以每次都做三重校验：体积下限 → `xz -t` 完整性 → `pg_restore --list` 能认出对象。
#   3. ⭐ **两服都备**（正式 + 测试），符合铁律「测试服和正式服关键的东西必须一样」。
#   4. ⭐ **异地一份**（同步到阿里）。只留本机防不了盘坏。
#   5. ⭐ **这台机器是多项目共用的**（还有 CinematicFlow / VibeSocial）→
#      所以全程 `nice`+`ionice`，绝不能因为备份把别人的服务拖慢。
#
# ⭐⭐ 为什么用「-Fc --compress=0 外面套 xz」这种看起来别扭的组合（2026-08-02 实测选出来的）：
#   | 方式                       | 体积   | 说明 |
#   |----------------------------|--------|------|
#   | -Fc --compress=6（最直觉） | 27.9MB | |
#   | -Fc --compress=9           | 27.7MB | 几乎没用 |
#   | 纯 SQL + gzip -9           | 27.8MB | |
#   | 纯 SQL + zstd -19          | 14.2MB | 但失去 pg_restore 能力 |
#   | **-Fc --compress=0 + xz**  | **8.2MB** | ⭐ 体积最小，且**保留** pg_restore 全部能力 |
#   跨境链路实测**丢包 30~40%、只有 74KB/s**，27.9MB 要传 7~15 分钟且很可能中断；
#   8.2MB 只要 2~3 分钟 —— **这是可靠性收益（更可能传完），不只是快**。
#   已实测：xz 解开后 `pg_restore --list` 仍认出 115 个对象、真恢复行数逐项吻合。
#
# 用法：
#   sudo bash flashmuse-db-backup.sh                    # 两服都备 + 同步阿里（cron 用这个）
#   sudo bash flashmuse-db-backup.sh --stack prod       # 只备正式服
#   sudo bash flashmuse-db-backup.sh --no-ali           # 不同步异地（排查时用）
#   sudo bash flashmuse-db-backup.sh --label pre-deploy # 打标签（部署前手动跑）
#
# 退出码：0=全好  1=备份失败（严重）  3=本机备份好了但异地同步失败（次要，但要看）
#
# ⛔ 不用 `set -e`：要自己控制每一步的失败处理（一服失败要继续备另一服），
#    但最终退出码必须反映有没有失败。这也是 AGENTS.md 里那条教训。
# ============================================================================

set -uo pipefail

BACKUP_ROOT=/opt/flashmuse/backups
LOG_FILE="$BACKUP_ROOT/backup.log"
STATUS_FILE="$BACKUP_ROOT/last-status.txt"
LOCK_FILE=/tmp/flashmuse-db-backup.lock

# 保留策略：本机留 14 天内全部 + 每月 1 号那份留 12 个月。
RETENTION_DAYS=14
MONTHLY_KEEP=12

# 体积下限（字节）。低于这个一定出了问题（空库/权限错/被截断）。
# 实测 xz 后：正式 ~8.2MB，测试 ~0.2MB。阈值取保守值，只抓"根本没导出来"。
MIN_BYTES_PROD=2000000
MIN_BYTES_STAGING=50000

# xz 参数：⭐ 用 `-9 -T 1`（2026-08-02 实测调出来的，别乱改）。
#   实测同一份 140MB 归档：
#     -6 -T 2  → 14.3MB      （字典只有 8MiB）
#     -9 -T 1  →  8.5MB      （字典 64MiB）  ← 小 40%，跨境省一半时间
#   我一开始想当然以为"-6 和 -9 只差 4%"，**实测差 40%** ——
#   因为这个库里有大量重复的中文提示词，字典越大收益越明显。⭐ 别再凭直觉调这个值。
#   为什么 `-T 1` 不用 `-T0`：`-9` 每个线程要 ~674MB 内存，
#   而这是**多项目共用的机器**（还有 CinematicFlow / VibeSocial），
#   `-T0` 会开 8 线程吃到 3.8GB（xz 自己都警告要降线程）。
#   单线程约 674MB、耗时 ~40 秒，对凌晨 3:30 的定时任务完全够用。
XZ_ARGS="-9 -T 1"

ALI_KEY=/opt/flashmuse/data/runtime/flashmuse_to_ali_ed25519
ALI_HOST=root@101.37.129.164
ALI_DEST=/opt/flashmuse-backups
ALI_SYNC_TRIES=3

STACKS="prod staging"
SYNC_ALI=1
LABEL=""

while [ $# -gt 0 ]; do
  case "$1" in
    --stack)  STACKS="$2"; shift 2 ;;
    --no-ali) SYNC_ALI=0; shift ;;
    --label)  LABEL="$2"; shift 2 ;;
    -h|--help) sed -n '1,50p' "$0"; exit 0 ;;
    *) echo "未知参数：$1"; exit 2 ;;
  esac
done

FAILED=0
REMOTE_FAILED=0
TS="$(date -u +%Y%m%d-%H%M%S)"

log()  { echo "[$(date -u '+%F %T') UTC] $*" | tee -a "$LOG_FILE"; }
fail() { log "❌ $*"; FAILED=1; }

# ⭐ 多项目共用机器：一律降优先级跑，绝不影响别人。
NICE="nice -n 19"
command -v ionice >/dev/null 2>&1 && NICE="ionice -c2 -n7 nice -n 19"

container_of() { case "$1" in prod) echo flashmuse-flashmuse-db-1 ;; staging) echo flashmuse-staging-staging-db-1 ;; esac; }
envfile_of()   { case "$1" in prod) echo /opt/flashmuse/data/.env.local ;; staging) echo /opt/flashmuse-staging/data/.env.local ;; esac; }
minbytes_of()  { case "$1" in prod) echo "$MIN_BYTES_PROD" ;; staging) echo "$MIN_BYTES_STAGING" ;; esac; }

backup_one() {
  local stack="$1"
  local container envfile minbytes outdir base target size objcount sha counts tmpdump
  container="$(container_of "$stack")"
  envfile="$(envfile_of "$stack")"
  minbytes="$(minbytes_of "$stack")"
  outdir="$BACKUP_ROOT/$stack"
  base="flashmuse-$stack-$TS${LABEL:+-$LABEL}"
  target="$outdir/$base.dump.xz"

  log "---- [$stack] 开始 ----"

  if ! docker inspect -f '{{.State.Running}}' "$container" 2>/dev/null | grep -q true; then
    fail "[$stack] 容器 $container 没在运行，跳过"; return 1
  fi
  mkdir -p "$outdir" || { fail "[$stack] 建目录失败"; return 1; }

  # ---- 1) pg_dump（自定义格式不压缩）→ xz ----
  # 用容器里的 pg_dump，版本天然与服务端一致（宿主根本没装 pg_dump）。
  # --no-owner --no-privileges：让 dump 能恢复进任何角色名的库（恢复演练要用）。
  # ⚠️ pipefail 已开 → 管道里任一环失败都会被捕获。
  if ! $NICE docker exec "$container" pg_dump -U flashmuse -d flashmuse \
        -Fc --compress=0 --no-owner --no-privileges 2>"$outdir/$base.err" \
        | $NICE xz $XZ_ARGS > "$target"; then
    fail "[$stack] pg_dump/xz 失败：$(head -c 400 "$outdir/$base.err" 2>/dev/null)"
    rm -f "$target"; return 1
  fi
  rm -f "$outdir/$base.err"

  # ---- 2) 体积下限（抓"备份成功但是空的"这类经典事故）----
  size=$(stat -c %s "$target" 2>/dev/null || echo 0)
  if [ "$size" -lt "$minbytes" ]; then
    fail "[$stack] 产物只有 $size 字节（下限 $minbytes），判定异常，已删除"
    rm -f "$target"; return 1
  fi

  # ---- 3) xz 完整性校验 ----
  if ! xz -t "$target" 2>/dev/null; then
    fail "[$stack] xz -t 完整性校验失败，已删除"; rm -f "$target"; return 1
  fi

  # ---- 4) 可读性校验：解开后 pg_restore 必须能认出对象 ----
  #    这一步才真正证明"这个文件是个能用的备份"，而不只是"一个非空文件"。
  tmpdump="/tmp/fmverify-$stack-$$.dump"
  if ! xz -dc "$target" > "$tmpdump" 2>/dev/null; then
    fail "[$stack] 解压校验失败，已删除"; rm -f "$target" "$tmpdump"; return 1
  fi
  objcount=$(docker exec -i "$container" pg_restore --list < "$tmpdump" 2>/dev/null | grep -c '^[0-9]')
  rm -f "$tmpdump"
  if [ "${objcount:-0}" -lt 20 ]; then
    fail "[$stack] pg_restore --list 只认出 ${objcount:-0} 个对象，备份可能损坏，已删除"
    rm -f "$target"; return 1
  fi

  # ---- 5) 关键表行数快照（以后可用来发现"悄悄变空"）----
  counts=$(docker exec "$container" psql -U flashmuse -d flashmuse -tAc \
    "select 'User='||(select count(*) from \"User\")
        ||' Session='||(select count(*) from \"Session\")
        ||' CreditLedger='||(select count(*) from \"CreditLedger\")
        ||' MediaAsset='||(select count(*) from \"MediaAsset\")
        ||' WorkspaceWorkflow='||(select count(*) from \"WorkspaceWorkflow\")
        ||' WorkspaceSession='||(select count(*) from \"WorkspaceSession\")
        ||' WorkspaceMessage='||(select count(*) from \"WorkspaceMessage\")" 2>/dev/null | tr -d '\r')

  # ---- 6) .env.local 一起备份 ----
  # 它既是密钥（API key）又是可变运行时状态（管理后台会改写它），而且**不在 git 里**，
  # 丢了要人工重配。所以必须跟着一起备。
  if [ -f "$envfile" ]; then
    cp "$envfile" "$outdir/$base.env.local" && chmod 600 "$outdir/$base.env.local"
  else
    log "[$stack] ⚠️ 没找到 $envfile，跳过 env 备份"
  fi

  # ---- 7) 清单（sha256 用于以后校验搬运有没有损坏）----
  sha=$(sha256sum "$target" | awk '{print $1}')
  cat > "$outdir/$base.manifest.txt" <<EOF
stack=$stack
created_utc=$(date -u '+%F %T')
container=$container
pg_version=$(docker exec "$container" psql -U flashmuse -d flashmuse -tAc 'show server_version' 2>/dev/null | tr -d '\r')
format=pg_dump -Fc --compress=0 | xz $XZ_ARGS
dump_file=$base.dump.xz
dump_bytes=$size
dump_sha256=$sha
restore_objects=$objcount
row_counts=$counts
label=${LABEL:-none}
EOF

  chmod 600 "$target"
  log "[$stack] ✅ 完成 $(du -h "$target" | cut -f1)  对象数=$objcount  已通过 xz -t 与 pg_restore --list 校验"
  log "[$stack]    行数 $counts"
  return 0
}

# ---- 保留策略：只删本脚本命名规则匹配的文件，且只在自己目录里 ----
prune_one() {
  # ⛔⛔ 坑（2026-08-02 实跑撞到）：**不能写成
  #   `local stack="$1" outdir="$BACKUP_ROOT/$stack"`** ——
  #   `local` 是内建命令，它的**全部参数会在它执行之前就被展开**，
  #   所以那时 `$stack` 还没赋值；配合 `set -u` 直接报
  #   "stack: unbound variable" 并中断整个脚本（当时 staging 和异地同步都没跑到）。
  #   ⭐ 必须先声明、再逐个赋值。
  local stack outdir deleted f bn day monthlies total
  stack="$1"
  outdir="$BACKUP_ROOT/$stack"
  deleted=0
  [ -d "$outdir" ] || return 0

  # a) 超过 RETENTION_DAYS 天、且不是"每月 1 号"的，删掉
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    bn=$(basename "$f")
    day=$(echo "$bn" | sed -n "s/^flashmuse-$stack-[0-9]\{6\}\([0-9]\{2\}\)-.*/\1/p")
    [ "$day" = "01" ] && continue      # 每月 1 号交给下面的 monthly 策略
    rm -f "$f" "${f%.dump.xz}.manifest.txt" "${f%.dump.xz}.env.local"
    deleted=$((deleted+1))
  done < <(find "$outdir" -maxdepth 1 -type f -name "flashmuse-$stack-*.dump.xz" -mtime +$RETENTION_DAYS 2>/dev/null)

  # b) 每月 1 号的只留最近 MONTHLY_KEEP 份
  monthlies=$(find "$outdir" -maxdepth 1 -type f -name "flashmuse-$stack-*01-*.dump.xz" 2>/dev/null | sort)
  total=$(echo "$monthlies" | grep -c . )
  if [ "$total" -gt "$MONTHLY_KEEP" ]; then
    while IFS= read -r f; do
      [ -n "$f" ] || continue
      rm -f "$f" "${f%.dump.xz}.manifest.txt" "${f%.dump.xz}.env.local"
      deleted=$((deleted+1))
    done < <(echo "$monthlies" | head -n $((total - MONTHLY_KEEP)))
  fi
  [ "$deleted" -gt 0 ] && log "[$stack] 已清理 $deleted 份过期备份"
  return 0
}

# ---- 异地同步：推到阿里那台 ----
sync_to_ali() {
  local sshcmd try rc remote_count out
  if [ ! -f "$ALI_KEY" ]; then log "⚠️ 阿里 SSH key 不存在：$ALI_KEY，跳过异地同步"; REMOTE_FAILED=1; return 1; fi
  sshcmd="ssh -i $ALI_KEY -o StrictHostKeyChecking=no -o ConnectTimeout=20 -o BatchMode=yes -o ServerAliveInterval=15 -o ServerAliveCountMax=4"

  if ! $sshcmd "$ALI_HOST" "mkdir -p $ALI_DEST" 2>/dev/null; then
    log "⚠️ 连不上阿里或建目录失败，跳过异地同步"; REMOTE_FAILED=1; return 1
  fi

  # ⭐⭐ 跨境链路实测丢包 30~40%、约 74KB/s，随时可能断。所以：
  #   --partial + --partial-dir=.rsync-partial : 断了把已传部分留在一个**单独目录**里，
  #     下次自动拿它当基准续传。
  #   重试 3 次，每次之间等 20 秒。
  #
  # ⛔⛔ 两个踩过的坑：
  #   1. **`--append-verify` 不能和 `--partial-dir` 一起用**
  #      （rsync 直接报 `--append cannot be used with --partial-dir`、rc=1，秒失败）。
  #      我最初两个都写了，3 次重试全部 4 秒内失败。
  #      ⭐ 选 `--partial-dir` 而不是 `--append-verify`，因为后者会把未传完的文件
  #      **以最终文件名**留在目标端 —— 对备份系统来说，一个"看起来像完整备份的截断文件"
  #      比没有备份更危险。`--partial-dir` 把半成品放在单独目录，不会冒充成品。
  #   2. **别把 rsync 的 stderr 丢掉**（我第一版写了 `2>&1 >/dev/null`），
  #      否则失败了根本不知道为什么，只能看到一个 rc=1。现在失败时会把原文记进日志。
  #
  #   ⛔ 故意**不加 --delete**：异地那份就该比本机留得更久（本机清了异地还在）。
  #      磁盘够：库才 164MB、xz 后 8MB，阿里还有 55G。
  for try in $(seq 1 $ALI_SYNC_TRIES); do
    rc=0
    out=$($NICE rsync -a --partial --partial-dir=.rsync-partial \
      --timeout=120 -e "$sshcmd" "$BACKUP_ROOT/" "$ALI_HOST:$ALI_DEST/" 2>&1) || rc=$?
    if [ "$rc" = "0" ]; then
      remote_count=$($sshcmd "$ALI_HOST" "find $ALI_DEST -name '*.dump.xz' | wc -l" 2>/dev/null | tr -d '\r')
      log "✅ 异地同步完成（第 $try 次尝试），阿里现有 ${remote_count:-?} 份备份"
      return 0
    fi
    log "⚠️ 异地同步第 $try/$ALI_SYNC_TRIES 次未完成（rsync rc=$rc）：$(echo "$out" | tail -2 | tr '\n' ' ')"
    [ "$try" -lt "$ALI_SYNC_TRIES" ] && sleep 20
  done
  log "⚠️ 异地同步最终未完成 —— **本机备份是好的**，只是异地这份没传完，下次 cron 会断点续传。"
  REMOTE_FAILED=1
  return 1
}

# ============================ 主流程 ============================
mkdir -p "$BACKUP_ROOT"
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "已有一个备份在跑（$LOCK_FILE 被占），本次退出。"
  exit 0
fi

log "======== 备份开始 ts=$TS stacks='$STACKS' ali=$SYNC_ALI label='${LABEL:-none}' ========"

for s in $STACKS; do
  case "$s" in
    prod|staging) backup_one "$s"; prune_one "$s" ;;
    *) fail "未知 stack：$s" ;;
  esac
done

[ "$SYNC_ALI" = "1" ] && sync_to_ali

log "本机备份占用：$(du -sh "$BACKUP_ROOT" 2>/dev/null | cut -f1)  剩余磁盘：$(df -h / | tail -1 | awk '{print $4}')"

if [ "$FAILED" != "0" ]; then
  echo "FAILED $TS" > "$STATUS_FILE"
  log "======== ❌ 备份存在失败项，见上面的 ❌ ========"
  exit 1
elif [ "$REMOTE_FAILED" != "0" ]; then
  echo "OK_LOCAL_ONLY $TS" > "$STATUS_FILE"
  log "======== ⚠️ 本机备份成功，但异地同步没完成 ========"
  exit 3
elif [ "$SYNC_ALI" = "1" ]; then
  echo "OK $TS" > "$STATUS_FILE"
  log "======== ✅ 备份成功（本机 + 异地）========"
  exit 0
else
  # 显式跳过了异地（--no-ali），别谎报"异地也成了"。
  echo "OK_NO_ALI $TS" > "$STATUS_FILE"
  log "======== ✅ 备份成功（仅本机，本次按 --no-ali 跳过异地）========"
  exit 0
fi
