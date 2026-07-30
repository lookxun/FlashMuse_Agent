#!/bin/bash
# =============================================================================
# 阿里 nginx：给 FlashMuse 的反代加「大响应不落盘」缓冲区（幂等，可重复跑）
#
# 为什么需要：nginx 默认 proxy_buffers = 8×4k = 32KB，而
#   /api/workspace-state?summary=1&panel=chat 的响应线上实测最大 1.19MB
#   → nginx 只能把整个响应先写磁盘临时文件再转发（error.log 里有
#     `an upstream response is buffered to a temporary file`），
#   叠加跨境传输 = 「打开工作台转圈 17~30 秒」。
#   根因分析全文见 handover/06-memo-tasks.md 的 M024。
#
# ⛔⛔ 为什么用"增量脚本"而不是把整份 conf 放进 FlashMuse 仓库覆盖过去：
#   阿里那份 `flashmuse-static-ip` 里**还有别的项目的配置**（/tiantangqiyuan/）。
#   整份覆盖会影响其它项目，违反「绝不能影响其它项目」的铁律。
#   所以这里只做**最小增量**：在每个 server 块的 client_body_timeout 之后插 4 行。
#
# ⭐ 阿里正式那两个 server 块**已经有 gzip 且 gzip_types 含 application/json**，
#   所以这里只补 proxy_buffer*，不动 gzip。
#   （阿里测试服 8080 那份 gzip_types 是缺的，走仓库里的
#     deploy/staging/flashmuse-test-8080.conf 整份替换，那份不含别的项目配置。）
#
# 用法（在腾讯主机上跑，会自动 ssh 到阿里）：
#   scp 本文件到腾讯 /tmp → ssh "sed -i 's/\r$//' /tmp/ali-add-proxy-buffers.sh && sudo bash /tmp/ali-add-proxy-buffers.sh"
# =============================================================================
set -e

ALI_SSH="ssh -o StrictHostKeyChecking=no -o ConnectTimeout=20 -i /opt/flashmuse/data/runtime/flashmuse_to_ali_ed25519 root@101.37.129.164"
TARGET="/etc/nginx/sites-enabled/flashmuse-static-ip"
MARKER="# flashmuse-proxy-buffers-v1"

$ALI_SSH "bash -s" <<'REMOTE'
set -e
TARGET="/etc/nginx/sites-enabled/flashmuse-static-ip"
MARKER="# flashmuse-proxy-buffers-v1"
TS=$(date +%Y%m%d-%H%M%S)

if [ ! -f "$TARGET" ]; then echo "!! $TARGET 不存在，放弃"; exit 1; fi

if grep -q "$MARKER" "$TARGET"; then
  echo "== 已经加过了（找到 $MARKER），幂等跳过 =="
  nginx -t && echo "== nginx -t OK =="
  exit 0
fi

BACKUP="/root/nginx-backups/flashmuse-static-ip.${TS}.bak"
mkdir -p /root/nginx-backups
cp "$TARGET" "$BACKUP"
echo "== 已备份到 $BACKUP =="

# 在每个 `client_body_timeout 300s;` 行后面插入 4 行（正式那份里两个 server 块各有一行）
awk -v marker="$MARKER" '
{
  print
  if ($0 ~ /^[[:space:]]*client_body_timeout[[:space:]]+300s;[[:space:]]*$/) {
    print ""
    print "    " marker " —— 大响应不落盘（见 handover/06 的 M024）"
    print "    proxy_buffer_size 32k;"
    print "    proxy_buffers 32 32k;"
    print "    proxy_busy_buffers_size 128k;"
    print "    proxy_max_temp_file_size 0;"
  }
}' "$BACKUP" > "$TARGET"

ADDED=$(grep -c "$MARKER" "$TARGET" || true)
echo "== 插入了 $ADDED 处（正式那份应为 2）=="

if ! nginx -t; then
  echo "!! nginx -t 失败，自动回滚"
  cp "$BACKUP" "$TARGET"
  nginx -t && echo "== 已回滚，配置恢复正常 =="
  exit 1
fi

nginx -s reload
echo "== nginx -t 通过并已 reload =="
grep -n "proxy_buffer_size\|proxy_max_temp_file_size" "$TARGET" || true
REMOTE

echo ""
echo "===== 验证：ali / static 域名应仍为 200，且响应带 Content-Encoding: gzip ====="
for u in https://ali.venusface.com/ https://static.venusface.com/; do
  printf "%s " "$u"
  curl -s -o /dev/null -w 'code=%{http_code}\n' --max-time 40 "$u"
done
