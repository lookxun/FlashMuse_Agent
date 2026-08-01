#!/bin/bash
#
# 安装 / 更新 FlashMuse 数据库备份的定时任务（幂等，可重复跑）
# ============================================================================
# 照抄 `deploy/ali/ali-add-upstream-keepalive.py` 那套做法的精神：
#   幂等 marker + 不碰别人的东西 + 装完立刻验证。
#
# ⛔⛔ **绝不碰 root 的 crontab。** 那台机器是多项目共用的：
#   root crontab 里有腾讯云 stargate 和 acme.sh 证书续期，
#   /etc/cron.d 里还有 certbot / e2scrub_all / sgagenttask / sysstat / yunjing。
#   所以我们只**新增一个独立文件** /etc/cron.d/flashmuse-db-backup，
#   删它也只影响我们自己。这样对其它项目零风险。
#
# 用法：sudo bash install-backup-cron.sh
# 卸载：sudo rm /etc/cron.d/flashmuse-db-backup
# ============================================================================

set -uo pipefail

SCRIPT_DIR=/opt/flashmuse/scripts
CRON_FILE=/etc/cron.d/flashmuse-db-backup
BACKUP_ROOT=/opt/flashmuse/backups
MARKER="# flashmuse-db-backup managed by install-backup-cron.sh"

echo "===== 1. 勘察：确认不会踩到别的项目 ====="
echo "-- /etc/cron.d 现有内容（我们只会新增 flashmuse-db-backup 这一个）:"
ls -1 /etc/cron.d
if [ -f "$CRON_FILE" ]; then
  echo "-- 已存在 $CRON_FILE（本次是更新）:"
  cat "$CRON_FILE"
fi
echo "-- root crontab 条数（改前）:"
ROOT_CRON_BEFORE=$(crontab -l 2>/dev/null | grep -c . || true)
echo "   $ROOT_CRON_BEFORE"

echo
echo "===== 2. 部署脚本到 $SCRIPT_DIR ====="
mkdir -p "$SCRIPT_DIR" "$BACKUP_ROOT"
for f in flashmuse-db-backup.sh flashmuse-db-restore.sh; do
  if [ ! -f "/tmp/fmbackup/$f" ]; then echo "❌ /tmp/fmbackup/$f 不存在（scp 没传上来？）"; exit 1; fi
  install -m 750 "/tmp/fmbackup/$f" "$SCRIPT_DIR/$f" || { echo "❌ 安装 $f 失败"; exit 1; }
  echo "   已安装 $SCRIPT_DIR/$f"
done
chmod 700 "$BACKUP_ROOT"

echo
echo "===== 3. 语法自检（bash -n）====="
for f in flashmuse-db-backup.sh flashmuse-db-restore.sh; do
  if bash -n "$SCRIPT_DIR/$f"; then echo "   $f 语法 OK"; else echo "❌ $f 语法错误"; exit 1; fi
done

echo
echo "===== 4. 写 cron（独立文件，不动 root crontab）====="
# ⚠️⚠️ 时区（2026-08-02 实测踩过）：这台机器的系统时区是 **Asia/Shanghai (CST, +0800)**，
#   而 **cron 按系统本地时区执行，不是 UTC**。
#   我第一版写了 `30 19 * * *` 并注释成"UTC 19:30 = 北京 03:30"，
#   实际会在**北京时间晚上 19:30（用户高峰）**跑备份 —— 完全跑反了。
#   ⭐ 现在直接按北京时间写：03:30 备份、周一 04:10 演练。
#   ⛔ 改这里之前先 `timedatectl` 确认时区，别照抄 UTC 的思维。
#
# ⚠️ 另一个实测发现：这台机器 **没有装 MTA**（日志里明确写
#   `(CRON) info (No MTA installed, discarding output)`）→ **cron 发不出邮件**。
#   所以绝不能依赖"失败了会收到邮件"，一切都要落到日志文件和 last-status.txt。
#
# ⚠️ 还有一条 crontab 语法陷阱：**`%` 在 crontab 里是特殊字符**（表示换行），
#   命令里出现 `%` 必须写成 `\%`，否则命令会被**从 % 处截断**。
#   下面两条命令里刻意不含 `%`。（我的验证探针就是因为用了 `date '+%F'` 被截断，
#   一度误判成"cron 没生效"。）
cat > "$CRON_FILE" <<EOF
$MARKER
# 每天 **北京时间 03:30**（系统时区 Asia/Shanghai，cron 按本地时区）备份正式服 + 测试服，
# 并同步到阿里异地。低峰时段，且刻意避开 acme.sh 的 1/7/13/19 点和 stargate 的每分钟任务。
# ⚠️ 本机没有 MTA，cron 发不出邮件 → 结果只看 $BACKUP_ROOT/backup.log 和 last-status.txt。
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
30 3 * * * root $SCRIPT_DIR/flashmuse-db-backup.sh >> $BACKUP_ROOT/cron.log 2>&1
# 每周一 **北京时间 04:10** 自动做一次「恢复演练」（恢复到临时库再删掉，不碰正式库）。
# ⭐ 没演练过的备份不算备份 —— 这条就是为了让"恢复不了"这种事提前暴露。
10 4 * * 1 root $SCRIPT_DIR/flashmuse-db-restore.sh drill prod >> $BACKUP_ROOT/drill.log 2>&1
EOF
chmod 644 "$CRON_FILE"
echo "   已写入 $CRON_FILE:"
sed 's/^/     /' "$CRON_FILE"
echo "   -- 确认命令里没有未转义的 % （有的话会被截断）:"
if grep -v '^#' "$CRON_FILE" | grep -q '[^\\]%'; then
  echo "      ❌ 发现未转义的 %，必须写成 \\%"; exit 1
else
  echo "      ✅ 没有"
fi

echo
echo "===== 5. 断言：没有动到别的项目 ====="
ROOT_CRON_AFTER=$(crontab -l 2>/dev/null | grep -c . || true)
if [ "$ROOT_CRON_BEFORE" != "$ROOT_CRON_AFTER" ]; then
  echo "❌ root crontab 条数变了（$ROOT_CRON_BEFORE → $ROOT_CRON_AFTER）—— 不该发生，请人工检查"
  exit 1
fi
echo "   root crontab 条数未变（$ROOT_CRON_AFTER）✅"
echo "   /etc/cron.d 现在:"
ls -1 /etc/cron.d | sed 's/^/     /'

echo
echo "===== 6. 让 cron 重新加载并确认它认了这个文件 ====="
systemctl reload cron 2>/dev/null || systemctl restart cron 2>/dev/null || service cron reload 2>/dev/null
sleep 1
systemctl is-active cron && echo "   cron 服务活着 ✅"

echo
echo "✅ 安装完成。"
echo "   手动跑一次： sudo $SCRIPT_DIR/flashmuse-db-backup.sh"
echo "   演练恢复：   sudo $SCRIPT_DIR/flashmuse-db-restore.sh drill prod"
echo "   看状态：     cat $BACKUP_ROOT/last-status.txt"
