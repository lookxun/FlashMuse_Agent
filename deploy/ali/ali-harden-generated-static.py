#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
阿里正式服 nginx（flashmuse-static-ip）：给 /generated/ 和 /home-assets/ 补安全头加固。

背景：2026-08-02 的「洞③ 上传 .html 同源存储型 XSS」修复时，腾讯正式 + 测试 3 份 conf 都加了
nosniff + 危险后缀 Content-Disposition: attachment，唯独阿里这份没碰（它 serve 同一份
/generated/ 静态镜像）。上传侧白名单已堵住"新增"，这里堵"历史已存在的危险文件从
ali/static 域名被直接访问渲染"。

⛔⛔ 为什么用精确替换 + 计数断言，而不是整份覆盖：
    这个文件里还有**别的项目**的配置（/tiantangqiyuan/），整份覆盖会影响它，违反铁律。
    每一类替换都断言条数，条数不符立刻退出、一个字不改。

改什么（与仓库 nginx/flashmuse.conf 的加固对齐）：
  A. 2 处 /generated/ 块：补 nosniff + 危险后缀 if attachment（if 里重写全部头——nginx 的 if
     是新层级，写了 add_header 就不再继承外层的，连 X-FlashMuse-Generated-Source 也要重写）。
  B. 2 处 /home-assets/ 块：只补 nosniff（这些是我们自己的素材，没有用户上传内容）。

⚠️ 注意：两个 /generated/ 块的 try_files 目标不同（@generated_proxy / @generated_proxy_ssl），
   所以匹配点选在两块完全相同的「X-FlashMuse-Generated-Source 行 + 收尾 }」上。
"""
import sys

TARGET = "/etc/nginx/sites-enabled/flashmuse-static-ip"
MARKER = "# flashmuse-generated-hardening-v1"

with open(TARGET, "r", encoding="utf-8") as f:
    src = f.read()

if MARKER in src:
    print("== 已经加过了（找到 marker），幂等跳过，不做任何修改 ==")
    sys.exit(0)

orig = src

# --- A：2 处 /generated/ 块 ---
pat_a = '        add_header X-FlashMuse-Generated-Source "local" always;\n    }'
rep_a = '''        add_header X-FlashMuse-Generated-Source "local" always;
        # flashmuse-generated-hardening-v1 —— 防同源存储型 XSS（对齐腾讯正式 conf，见 handover CHANGELOG 第二十六次会话）
        add_header X-Content-Type-Options "nosniff" always;
        # ⛔ 危险后缀一律当附件下载，绝不在本域内渲染/执行。
        # ⚠️ nginx 的 if 是新配置层级：里面写了 add_header 就不再继承外层的 → 全部头重写一遍。
        if ($uri ~* "\\.(?:html?|xhtml|xht|shtml|svgz?|xml|xsl|js|mjs|css|wasm)$") {
            add_header Content-Disposition "attachment" always;
            add_header X-Content-Type-Options "nosniff" always;
            add_header Cache-Control "public, max-age=2592000, immutable" always;
            add_header Access-Control-Allow-Origin * always;
            add_header X-FlashMuse-Generated-Source "local" always;
        }
    }'''
cnt_a = src.count(pat_a)
src = src.replace(pat_a, rep_a)

# --- B：2 处 /home-assets/ 块 ---
pat_b = '        add_header X-FlashMuse-Local-Static "home-assets" always;\n    }'
rep_b = '''        add_header X-FlashMuse-Local-Static "home-assets" always;
        add_header X-Content-Type-Options "nosniff" always;
    }'''
cnt_b = src.count(pat_b)
src = src.replace(pat_b, rep_b)

print("== 替换计数：A(/generated/)=%d  B(/home-assets/)=%d ==" % (cnt_a, cnt_b))

if (cnt_a, cnt_b) != (2, 2):
    print("!! 计数与预期 (2, 2) 不符，说明服务器上的配置和勘察时不一样了。")
    print("!! 为安全起见一个字都不改，直接退出。请人工核对后再跑。")
    sys.exit(2)

# 残留检查：nosniff 条数必须精确等于 6（改前一个都没有；2 个 generated 块各 2 条[外层+if 内] + 2 个 home-assets 块各 1 条）
if src.count('add_header X-Content-Type-Options "nosniff" always;') != 6:
    print("!! nosniff 条数不是 6，退出不改")
    sys.exit(3)

# 安全断言：别的项目的配置必须一个字没动
for keep in ["/tiantangqiyuan/", "/var/www/tiantangqiyuan/", "X-TiantangQiyuan-Site"]:
    if orig.count(keep) != src.count(keep):
        print("!! 别的项目(tiantangqiyuan)的配置条数变了，退出不改")
        sys.exit(4)

with open(TARGET, "w", encoding="utf-8") as f:
    f.write(src)

print("== 已写入 %s ==" % TARGET)
