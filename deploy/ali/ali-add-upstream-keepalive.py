#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
阿里正式服 nginx（flashmuse-static-ip）：加「回源腾讯的长连接复用 upstream keepalive」。

⛔⛔ 为什么用精确替换 + 计数断言，而不是整份覆盖：
    这个文件里还有**别的项目**的配置（/tiantangqiyuan/），整份覆盖会影响它，违反铁律。
    所以这里只做最小改动，且每一类替换都断言条数，条数不符立刻退出、一个字不改。

改什么（对应 2026-08-01 测试服已验证有效的那套）：
  1. 顶部加 `upstream fm_prod_app`（119.28.116.16:5000 + keepalive 32）和 `map $fm_prod_conn_upgrade`
  2. 8 处 `proxy_pass http://119.28.116.16:5000;` → `proxy_pass http://fm_prod_app;`
     其中 6 处（@generated_proxy / = / / = /api/media-thumbnail 各两个 server 块）
     原本连 `proxy_http_version 1.1` 都没有（= HTTP/1.0 + Connection: close，keepalive 池等于没用）
     → 顺带补 `proxy_http_version 1.1` + `Connection ""`。
  3. 2 处 `location /` 里写死的 `Connection "upgrade"` → map 出来的变量
     （原来每个请求都被当成升级请求，连接永不复用）。

为什么这么改能快：阿里→腾讯实测 RTT 255ms、丢包 33%，
握手丢包只能 RTO 指数退避（1.3s 起）。测试服改完中位数 1.62s → 0.30s（快 5.4 倍）。
"""
import re
import sys

TARGET = "/etc/nginx/sites-enabled/flashmuse-static-ip"
MARKER = "# flashmuse-upstream-keepalive-v1"

UPSTREAM_BLOCK = MARKER + """ —— 回源腾讯的长连接池（治「走阿里比直连慢」，见 handover 的 M027）
# 阿里 -> 腾讯新加坡实测 RTT 255ms、丢包 33%；不复用连接时每个请求都要等 SYN 重传（1.3s 起）。
upstream fm_prod_app {
    server 119.28.116.16:5000;
    keepalive 32;
    keepalive_timeout 300s;
    keepalive_requests 1000;
}

# 普通请求 -> Connection 置空（走 HTTP/1.1 长连接）；只有真的 WebSocket 才发 Connection: upgrade
map $http_upgrade $fm_prod_conn_upgrade {
    default upgrade;
    ''      '';
}

"""

with open(TARGET, "r", encoding="utf-8") as f:
    src = f.read()

if MARKER in src:
    print("== 已经加过了（找到 marker），幂等跳过，不做任何修改 ==")
    sys.exit(0)

orig = src

# --- 替换 A：那 6 处「proxy_pass 后紧跟 Host」的 location，补 http_version + Connection "" ---
pat_a = 'proxy_pass http://119.28.116.16:5000;\n        proxy_set_header Host'
rep_a = ('proxy_pass http://fm_prod_app;\n'
         '        proxy_http_version 1.1;\n'
         '        proxy_set_header Connection "";\n'
         '        proxy_set_header Host')
cnt_a = src.count(pat_a)
src = src.replace(pat_a, rep_a)

# --- 替换 B：2 处 location / （已有 proxy_http_version，只换 upstream 名） ---
pat_b = 'proxy_pass http://119.28.116.16:5000;\n        proxy_request_buffering off;'
rep_b = 'proxy_pass http://fm_prod_app;\n        proxy_request_buffering off;'
cnt_b = src.count(pat_b)
src = src.replace(pat_b, rep_b)

# --- 替换 C：2 处写死的 Connection "upgrade" -> map 变量 ---
pat_c = 'proxy_set_header Connection "upgrade";'
rep_c = 'proxy_set_header Connection $fm_prod_conn_upgrade;'
cnt_c = src.count(pat_c)
src = src.replace(pat_c, rep_c)

print("== 替换计数：A(补 1.1+Connection 的 location)=%d  B(location /)=%d  C(Connection upgrade)=%d ==" % (cnt_a, cnt_b, cnt_c))

if (cnt_a, cnt_b, cnt_c) != (6, 2, 2):
    print("!! 计数与预期 (6, 2, 2) 不符，说明服务器上的配置和勘察时不一样了。")
    print("!! 为安全起见一个字都不改，直接退出。请人工核对后再跑。")
    sys.exit(2)

# 残留检查：不该再有任何裸写的 119.28.116.16:5000 的 proxy_pass
leftover = re.findall(r'proxy_pass\s+http://119\.28\.116\.16:5000', src)
if leftover:
    print("!! 还剩 %d 处没换掉的 proxy_pass，退出不改" % len(leftover))
    sys.exit(3)

# --- 插入 upstream + map 到文件最前面（sites-enabled 被 include 在 http 上下文，合法） ---
src = UPSTREAM_BLOCK + src

# 安全断言：别的项目的配置必须一个字没动
for keep in ["/tiantangqiyuan/", "/var/www/tiantangqiyuan/", "X-TiantangQiyuan-Site"]:
    if orig.count(keep) != src.count(keep):
        print("!! 别的项目(tiantangqiyuan)的配置条数变了，退出不改")
        sys.exit(4)

with open(TARGET, "w", encoding="utf-8") as f:
    f.write(src)

print("== 已写入 %s ==" % TARGET)
