# Next Actions（2026-07-21 重建）

> 历史 END-OF-SESSION 记录都在 `historical-handover-docs-last-used-2026-07-21/05-next-actions.md`（很长）。这里只留当前有效待办。

## 当前状态

⭐ **四方同步：正式服 = 测试服 = 本地 = GitHub = `v1.0.0.43`**（2026-07-27，commit `5151fe0`）。四域名 200，无待部署、无未推、无未应用迁移。工作树干净。

## 本对话（2026-07-27）已完成（细节见 CHANGELOG 2026-07-27 顶条）
- **视频"卡下载→僵尸任务"根治**（下载 3min 超时 + ffmpeg 60s 超时 + 存盘锁 inFlight 假死自愈 8min + stale 30min→8min）。
- **恢复乐观显示**：视频出结果先用远程地址展示（角标"资产保存中..."），本地存好后无感换本地（"✓保存成功"2s 后 1s 渐隐）。对话流+工作流统一；资产库仍只存本地 url+全参数（零改动）；OpenRouter 需密钥视频不预览；只做视频。
- **工作流生成动画**：侧栏工作流历史条目 + "工作流模式"入口显示 `HaloPulseIndicator`（对齐对话流/资产库）。
- 已整份部署正式服 v1.0.0.43 + push。

## ⭐ 本对话遗留的待定项（下一个 AI 注意）
1. **"资产保存中"角标对"存盘快的视频"会一闪而过/看不到**（用户 2026-07-27 反馈，验证过 `has_preview=YES`、后端没问题）。根因=前端视频轮询前 2min 每 10s、之后每 **30s**（`chat-workbench.tsx:1092-1094` `FAST_VIDEO_POLL_*`/`SLOW_VIDEO_POLL_INTERVAL_MS`）；后端只在火山出片后才写 preview，seedance-mini 存盘只几十秒，这个"保存中窗口"夹在两次 30s 轮询间被跳过→直接显示"保存成功"。**慢/跨境卡的视频窗口长、一定能显示（这才是功能真正目标）**。**待用户拍板**是否把慢轮询 30s→15s（+拉长 10s 快轮询窗口）让快视频也稳定显示——代价是生成期间轮询翻倍（`/api/generation-status` 很轻、影响小）。工作流侧轮询 `videoPollIntervalMs` 同理要一起调。
2. **正式服僵尸 video job 未清**：ID_686996（`312876953@qq.com`）requestId `d049d7ad-9819-4177-8dc4-bf270f4ea0e2:video:0`，status 仍 `running`（07-24 那次卡下载假死的历史遗留，本次代码已根治此类不再复发）。用户交代先不清，以后可手动 `UPDATE "GenerationJob" SET status='failed'...`。

## 最优先
- 无强制待办。用户会自己测。**叫你测试才测试，别自动开 Playwright。**

## 编辑类收尾剩余小项（非阻塞，待用户定）
1. **编辑类定价**：去背景本地抠图零成本、橡皮/高清走云模型，是否按普通图片计费或调价——待用户定。
2. **去背景资产库 model 标签**：进资产库那条仍带计算出的 `input.model`，资产库预览可能仍显示模型标签；工作流节点本身已干净。待用户定是否清。
3. 候选链"失败自动降级"逻辑本地只验证过首选成功路径，真降级要线上某模型报错才触发。

## 更早的待办（都非紧急）

1. **验收（可选）**：用户可到正式服硬刷抽验 @引用资产三处（视频/资产不再重复、左侧分类溢出滚动条常驻可下拉）；道具生成三档比例/写实出手办；融合生视频参考视频总时长>15s 弹"当前视频加起来是 XX.X 秒…"。
2. **对话流"最多4张"改原生 n**（暂缓，风险高）：多图 orchestration 与 Agent 共用单槽位/重试结构，当前申请4次(每次n=1)功能正常。要做需单独改+验证。
3. **清理旧 mention 死常量**（`mentionAssetTypes`/`isMentionGroupAsset`/`mentionGroupToAssetCountKey`/`mentionAssetTypeLabels`/`MentionAssetGroupType`，已无引用、保留无害）。
4. **复查 `GenerationEvent` 失败原因**（用户交代）：断线重连/BBR 上线跑一阵后，查失败原因聚合 + `/opt/flashmuse/data/runtime/*-diagnostics-log.jsonl`，确认"服务器繁忙"占比是否下降、"真人检测→服务器繁忙"是否消失、有无**新的可恢复错误**要补进 `isTransientServerError`（唯一权威判定）。
5. **M018 / M019 押后**（见 06-memo-tasks）：M018 刚上传媒体不刷新自动切阿里镜像；M019 工作流 canvasJson 大字段重构。
6. **上传规则若上正式服**：视频 200MB 规则需先把正式 nginx `client_max_body_size`（历史 20m）调到 ≥200MB + 上传超时（用户交代部署前评估，未批准前不改服务器）。

## 部署记忆（速查，详见 03）

- 腾讯 ssh：`ssh -i "C:\Users\ASUS\AppData\Local\Temp\opencode\CinematicFlow.pem" ubuntu@119.28.116.16`（docker 加 sudo）。
- 正式服整份对齐 = 备份 → rsync staging→prod（排除 node_modules/.next/tmp/*.log/.git/.env.local/.runtime）→ `docker compose up -d --build flashmuse-app`（entrypoint 自动 migrate）→ `/tmp/syncali.sh`（阿里**正式**镜像）→ `/tmp/health.sh` 四域名 200 → commit+push。正式服不自增版本。
- `/tmp/syncali.sh`+`/tmp/health.sh` 重启清、需重建（内容见 03）；阿里 key root 属主必 sudo。
- PowerShell 内联 `$()`/中文/引号会坏 → 写 .sh scp + `sed -i 's/\r$//'` + bash；改中文源码用 edit 工具禁 Set-Content；一次性 node 脚本放进容器 `/app` 跑。
