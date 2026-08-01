#!/bin/bash
#
# FlashMuse 数据库恢复 / 恢复演练
# ============================================================================
# ⭐⭐ 为什么必须有这个脚本：**没演练过的备份不算备份。**
# 备份最常见的失败不是"没备成"，而是"真要用的时候发现恢复不了"
# （版本不对、角色不存在、扩展缺失、文件其实是空的、格式不可 seek……）。
# 所以本脚本有 `drill`（演练）模式：把备份恢复到一个**临时库**，比对行数，再删掉临时库
# —— 全程**不碰正式库**。
#
# ⭐ 2026-08-02 首次演练就靠它抓到了一个真 bug：当时用 stdin 管道喂 pg_restore，
#   而自定义格式 + `-j`（并行）**要求归档可 seek**，管道不行 → 恢复出 0 张表。
#   如果没有这一步演练，我们会一直以为"备份好着呢"。
#
# 用法：
#   # ① 演练（安全，cron 每周自动跑一次）
#   sudo bash flashmuse-db-restore.sh drill prod
#   sudo bash flashmuse-db-restore.sh drill prod /opt/flashmuse/backups/prod/xxx.dump.xz
#
#   # ② 真恢复（危险！会覆盖目标库）
#   sudo bash flashmuse-db-restore.sh restore prod /path/xxx.dump.xz --i-know-this-overwrites-data
#
# ⛔⛔ `restore` 会**丢掉目标库当前的数据**，只在真出事时用。
#    本脚本会在覆盖前自动先做一份 `--label before-restore` 的备份。
# ============================================================================

set -uo pipefail

BACKUP_ROOT=/opt/flashmuse/backups

MODE="${1:-}"
STACK="${2:-}"
DUMP="${3:-}"
CONFIRM="${4:-}"

usage() { sed -n '1,32p' "$0"; exit 2; }
[ -z "$MODE" ] && usage
[ -z "$STACK" ] && usage

case "$STACK" in
  prod)    CONTAINER=flashmuse-flashmuse-db-1;         APP=flashmuse-flashmuse-app-1 ;;
  staging) CONTAINER=flashmuse-staging-staging-db-1;   APP=flashmuse-staging-staging-app-1 ;;
  *) echo "stack 只能是 prod 或 staging"; exit 2 ;;
esac

# 没指定就取该 stack 最新的一份（.dump.xz 新格式和 .dump 老格式都认）
if [ -z "$DUMP" ]; then
  DUMP=$(find "$BACKUP_ROOT/$STACK" -maxdepth 1 -type f \( -name "flashmuse-$STACK-*.dump.xz" -o -name "flashmuse-$STACK-*.dump" \) 2>/dev/null | sort | tail -1)
  [ -z "$DUMP" ] && { echo "❌ $BACKUP_ROOT/$STACK 下没有任何备份"; exit 1; }
  echo "未指定备份文件，自动选用最新的一份："
fi
[ -f "$DUMP" ] || { echo "❌ 文件不存在：$DUMP"; exit 1; }
echo "  备份文件 = $DUMP  ($(du -h "$DUMP" | cut -f1))"
echo "  容器     = $CONTAINER"

# 清单校验（sha256 证明搬运过程没损坏）
case "$DUMP" in
  *.dump.xz) MANIFEST="${DUMP%.dump.xz}.manifest.txt" ;;
  *)         MANIFEST="${DUMP%.dump}.manifest.txt" ;;
esac
if [ -f "$MANIFEST" ]; then
  echo "  清单记录的行数：$(grep '^row_counts=' "$MANIFEST" | cut -d= -f2-)"
  WANT=$(grep '^dump_sha256=' "$MANIFEST" | cut -d= -f2)
  GOT=$(sha256sum "$DUMP" | awk '{print $1}')
  if [ -n "$WANT" ] && [ "$WANT" != "$GOT" ]; then
    echo "❌ sha256 不匹配，文件可能已损坏！"; echo "   期望 $WANT"; echo "   实际 $GOT"; exit 1
  fi
  [ -n "$WANT" ] && echo "  sha256 校验通过"
fi

# xz 格式先做完整性校验
case "$DUMP" in
  *.xz) if xz -t "$DUMP" 2>/dev/null; then echo "  xz -t 完整性校验通过"; else echo "❌ xz -t 校验失败，文件已损坏"; exit 1; fi ;;
esac

# 把备份准备成容器内一个「可 seek 的普通文件」。
# ⛔⛔ 关键：**绝不能用 stdin 管道**（自定义格式 + -j 需要 seek，管道会恢复出 0 张表）。
#     所以一律解压到宿主临时文件 → docker cp 进容器 → 按路径恢复。
INCPATH=""
prepare_in_container() {
  local hostfile="/tmp/fm-restore-$$.dump"
  case "$DUMP" in
    *.xz) xz -dc "$DUMP" > "$hostfile" || { echo "❌ 解压失败"; return 1; } ;;
    *)    cp "$DUMP" "$hostfile" || { echo "❌ 复制失败"; return 1; } ;;
  esac
  INCPATH="/tmp/fm-restore-$$.dump"
  docker cp "$hostfile" "$CONTAINER:$INCPATH" >/dev/null 2>&1 || { echo "❌ docker cp 失败"; rm -f "$hostfile"; return 1; }
  rm -f "$hostfile"
  return 0
}
cleanup_in_container() {
  [ -n "$INCPATH" ] && docker exec "$CONTAINER" rm -f "$INCPATH" >/dev/null 2>&1
}

counts_of() {
  docker exec "$CONTAINER" psql -U flashmuse -d "$1" -tAc \
    "select 'User='||(select count(*) from \"User\")
        ||' CreditLedger='||(select count(*) from \"CreditLedger\")
        ||' MediaAsset='||(select count(*) from \"MediaAsset\")
        ||' WorkspaceWorkflow='||(select count(*) from \"WorkspaceWorkflow\")
        ||' WorkspaceSession='||(select count(*) from \"WorkspaceSession\")
        ||' WorkspaceMessage='||(select count(*) from \"WorkspaceMessage\")" 2>/dev/null | tr -d '\r'
}

# ============================ 演练 ============================
if [ "$MODE" = "drill" ]; then
  TMPDB="flashmuse_drill_$(date -u +%H%M%S)"
  echo
  echo "===== 恢复演练：目标临时库 $TMPDB（⭐ 全程不碰正式库）====="

  echo "-- 1) 建临时库"
  docker exec "$CONTAINER" psql -U flashmuse -d postgres -c "create database $TMPDB;" >/dev/null 2>&1 \
    || { echo "❌ 建临时库失败"; exit 1; }

  cleanup() {
    echo "-- 清理临时库 $TMPDB"
    docker exec "$CONTAINER" psql -U flashmuse -d postgres -c "drop database if exists $TMPDB;" >/dev/null 2>&1
    cleanup_in_container
  }
  trap cleanup EXIT

  echo "-- 2) 准备归档文件（解压 + 送进容器）"
  prepare_in_container || exit 1

  echo "-- 3) pg_restore 到临时库"
  DRILL_RC=0
  docker exec "$CONTAINER" pg_restore -U flashmuse -d "$TMPDB" \
      --no-owner --no-privileges -j 4 "$INCPATH" > /tmp/fm-drill-restore.log 2>&1 || DRILL_RC=$?
  if [ "$DRILL_RC" != "0" ]; then
    echo "   ⚠️ pg_restore 退出码 $DRILL_RC，输出如下（判断是无害警告还是真失败）："
    sed 's/^/     /' /tmp/fm-drill-restore.log | head -25
  fi

  echo "-- 4) 比对行数"
  RESTORED=$(counts_of "$TMPDB")
  LIVE=$(counts_of flashmuse)
  echo "     恢复出来的库 : $RESTORED"
  echo "     当前线上的库 : $LIVE"

  TCOUNT=$(docker exec "$CONTAINER" psql -U flashmuse -d "$TMPDB" -tAc \
      "select count(*) from information_schema.tables where table_schema='public';" 2>/dev/null | tr -d '\r')
  echo "-- 5) 恢复出来的库有 $TCOUNT 张表"

  if [ "${TCOUNT:-0}" -lt 10 ]; then echo; echo "❌ 演练失败：表太少（$TCOUNT）"; exit 1; fi
  if [ -z "$RESTORED" ]; then echo; echo "❌ 演练失败：查不到行数"; exit 1; fi
  echo
  echo "✅ 恢复演练通过：这份备份是真的能恢复的。"
  exit 0
fi

# ============================ 真恢复 ============================
if [ "$MODE" = "restore" ]; then
  if [ "$CONFIRM" != "--i-know-this-overwrites-data" ]; then
    echo
    echo "⛔ 拒绝执行：真恢复会**覆盖 $STACK 当前的数据库**。"
    echo "   确认要做，请在命令最后加上： --i-know-this-overwrites-data"
    exit 2
  fi
  echo
  echo "⚠️⚠️ 即将覆盖 $STACK 的数据库。先自动做一份「恢复前」的备份……"
  if ! bash "$(dirname "$0")/flashmuse-db-backup.sh" --stack "$STACK" --no-ali --label before-restore; then
    echo "❌ 恢复前备份失败 —— 为安全起见中止。"; exit 1
  fi

  echo "-- 准备归档文件"
  prepare_in_container || exit 1
  trap cleanup_in_container EXIT

  echo "-- 停应用容器（避免恢复期间有写入）"
  docker stop "$APP" >/dev/null 2>&1

  echo "-- 重建 public schema"
  if ! docker exec "$CONTAINER" psql -U flashmuse -d flashmuse -c \
      "drop schema public cascade; create schema public;"; then
    echo "❌ 重建 schema 失败"; docker start "$APP" >/dev/null 2>&1; exit 1
  fi

  echo "-- pg_restore"
  RC=0
  docker exec "$CONTAINER" pg_restore -U flashmuse -d flashmuse \
    --no-owner --no-privileges -j 4 "$INCPATH" || RC=$?
  [ "$RC" != "0" ] && echo "⚠️ pg_restore 退出码 $RC（下面核对行数确认是否成功）"

  echo "-- 起应用容器"
  docker start "$APP" >/dev/null 2>&1

  echo "-- 恢复后行数：$(counts_of flashmuse)"
  echo
  echo "✅ 恢复完成。请立刻上号验证（登录 / 对话 / 工作流 / 资产库）。"
  exit 0
fi

usage
