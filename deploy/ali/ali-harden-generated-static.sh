#!/bin/bash
# =============================================================================
# 阿里 nginx（flashmuse-static-ip）：给 /generated/ + /home-assets/ 补安全头（幂等，可重复跑）
#
# 背景：2026-08-02「洞③ 上传 .html 同源 XSS」修复时加固了腾讯正式 + 测试 3 份 conf，
#   唯独阿里这份没碰（混着别的项目 /tiantangqiyuan/，禁止整份覆盖）。
#   本脚本 = 配套的幂等增量脚本，改法和 deploy/ali/ali-add-upstream-keepalive.py 一致：
#   精确替换 + 计数断言 + 断言别的项目没动 + 备份 + nginx -t + 失败自动回滚 + 只 reload。
#
# 用法（在腾讯主机上跑，会自动 ssh 到阿里）：
#   scp ali-harden-generated-static.py + 本文件到腾讯 /tmp
#   → ssh "sed -i 's/\r$//' /tmp/ali-harden-generated-static.sh && sudo bash /tmp/ali-harden-generated-static.sh"
# =============================================================================
set -e

ALI_SSH="ssh -o StrictHostKeyChecking=no -o ConnectTimeout=20 -i /opt/flashmuse/data/runtime/flashmuse_to_ali_ed25519 root@101.37.129.164"
TARGET="/etc/nginx/sites-enabled/flashmuse-static-ip"
MARKER="# flashmuse-generated-hardening-v1"

# 先把 python 脚本传到阿里
scp -o StrictHostKeyChecking=no -i /opt/flashmuse/data/runtime/flashmuse_to_ali_ed25519 /tmp/ali-harden-generated-static.py root@101.37.129.164:/tmp/

$ALI_SSH "bash -s" <<'REMOTE'
set -e
TARGET="/etc/nginx/sites-enabled/flashmuse-static-ip"
TS=$(date +%Y%m%d-%H%M%S)

if [ ! -f "$TARGET" ]; then echo "!! $TARGET 不存在，放弃"; exit 1; fi

BACKUP="/root/nginx-backups/flashmuse-static-ip.${TS}.bak"
mkdir -p /root/nginx-backups
cp "$TARGET" "$BACKUP"
echo "== 已备份到 $BACKUP（⛔ 备份不放 sites-enabled，目录里任何文件都会被 include）=="

if ! python3 /tmp/ali-harden-generated-static.py; then
  echo "!! python 增量脚本失败（计数不符/断言不过），文件未被修改，直接退出"
  exit 1
fi

if ! nginx -t; then
  echo "!! nginx -t 失败，自动回滚"
  cp "$BACKUP" "$TARGET"
  nginx -t && echo "== 已回滚，配置恢复正常 =="
  exit 1
fi

nginx -s reload
echo "== nginx -t 通过并已 reload =="
REMOTE

echo ""
echo "===== 验证 1：造一个临时 .html 实测 attachment 头（测完即删） ====="
$ALI_SSH "bash -s" <<'REMOTE'
TEST=/var/www/flashmuse-static/generated/sec-test-hardening.html
echo '<html><body>sec test</body></html>' > "$TEST"
echo "--- .html（应为 attachment + nosniff）---"
curl -s -D - -o /dev/null --max-time 30 "https://static.venusface.com/generated/sec-test-hardening.html" | grep -i 'HTTP/\|content-disposition\|x-content-type'
rm -f "$TEST"
echo "--- .html 已删除 ---"
JPG=$(ls /var/www/flashmuse-static/generated/images/ 2>/dev/null | grep -m1 -i '\.jpe\?g$' || true)
if [ -n "$JPG" ]; then
  echo "--- 正常图片 /generated/images/$JPG（应无 attachment、有 nosniff）---"
  curl -s -D - -o /dev/null --max-time 30 "https://static.venusface.com/generated/images/$JPG" | grep -i 'HTTP/\|content-disposition\|x-content-type'
else
  echo "（没找到 jpg 样本，跳过正常文件验证）"
fi
REMOTE

echo ""
echo "===== 验证 2：ali/static 域名仍 200，别的项目没被动 ====="
for u in https://ali.venusface.com/ https://static.venusface.com/ "https://ali.venusface.com/tiantangqiyuan/"; do
  printf "%s " "$u"
  curl -s -o /dev/null -w 'code=%{http_code}\n' --max-time 40 "$u"
done
