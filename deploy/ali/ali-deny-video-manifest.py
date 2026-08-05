#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
阿里正式服 nginx（flashmuse-static-ip）：禁止公网读取 /generated/videos/manifest.json。

背景（2026-08-04）：`videos/manifest.json` 是服务端的「视频恢复台账」，里面有最近 500 条
视频的**全站用户完整提示词 + 用户 ID + 供应商预签名下载地址**（24 小时内任何人可直接下片）。
它历史上落在 public/generated/ 下，而 /generated/ 是 nginx 直接 serve 的**公网无鉴权**目录
→ 实测 `https://static.venusface.com/generated/videos/manifest.json` 返回 200 + 1.68MB 明文。

代码已把台账迁到 `.runtime/video-manifest.json`，并在写入成功后自动删掉腾讯本地那份老文件；
**但阿里镜像里那一份删不掉**（它是被同步脚本推过去的），所以必须在阿里 nginx 上兜一道。

⛔⛔ 为什么用精确替换 + 计数断言，而不是整份覆盖：
    这个文件里还有**别的项目**的配置（/tiantangqiyuan/），整份覆盖会影响它，违反铁律。

改什么：在 2 个 `location /generated/ {`（80 与 443 两个 server 块）之前各插一行精确匹配 404。
`location =` 是精确匹配，优先级高于前缀匹配，所以插在前面/后面都生效——这里选插在前面便于阅读。

用法（在阿里那台上以 root 跑）：
    sudo cp /etc/nginx/sites-enabled/flashmuse-static-ip /root/flashmuse-static-ip.bak.$(date +%s)
    sudo python3 ali-deny-video-manifest.py && sudo nginx -t && sudo nginx -s reload
⛔ 备份**绝不能放 sites-enabled/**（nginx 会 include 目录下所有文件 → duplicate upstream 起不来）。
"""
import sys

TARGET = "/etc/nginx/sites-enabled/flashmuse-static-ip"
MARKER = "# flashmuse-deny-video-manifest-v1"

with open(TARGET, "r", encoding="utf-8") as f:
    src = f.read()

if MARKER in src:
    print("== 已经加过了（找到 marker），幂等跳过，不做任何修改 ==")
    sys.exit(0)

orig = src

pat = "    location /generated/ {"
rep = """    %s —— 内部台账不对外：含全站用户提示词 + 供应商预签名地址（handover 2026-08-04）
    location = /generated/videos/manifest.json { return 404; }

    location /generated/ {""" % MARKER

cnt = src.count(pat)
src = src.replace(pat, rep)

print("== 替换计数：location /generated/ = %d ==" % cnt)

if cnt != 2:
    print("!! 计数与预期 2 不符，说明服务器上的配置和勘察时不一样了。")
    print("!! 为安全起见一个字都不改，直接退出。请人工核对后再跑。")
    sys.exit(2)

# 残留检查：deny 行必须精确等于 2 条
if src.count("location = /generated/videos/manifest.json { return 404; }") != 2:
    print("!! deny 行条数不是 2，退出不改")
    sys.exit(3)

# 安全断言：别的项目的配置必须一个字没动
for keep in ["/tiantangqiyuan/", "/var/www/tiantangqiyuan/", "location @generated_proxy", "location @generated_proxy_ssl"]:
    if orig.count(keep) != src.count(keep):
        print("!! 既有配置条数变了（%s），退出不改" % keep)
        sys.exit(4)

with open(TARGET, "w", encoding="utf-8") as f:
    f.write(src)

print("== 已写入 %s ==" % TARGET)
print("== 记得：nginx -t && nginx -s reload，然后 curl 验证返回 404 ==")
