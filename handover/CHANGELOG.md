# Current Handover Changelog（2026-07-21 重建起）

> 本批 CHANGELOG 从 2026-07-21 交接文档重建开始记。**此前的全部历史流水**（约 580KB，含 2026-06 起到 07-21 每一次改动/部署细节）在 `historical-handover-docs-last-used-2026-07-21/CHANGELOG.md`，遇到需要历史上下文的难题再翻。

## 2026-07-21（交接文档归档重建）

- 用户指出交接文档已超 1.2MB（CHANGELOG 580KB / 01 276KB / 05 200KB）。按"交接文档维护规则"把整批当前文档归档进 `handover/historical-handover-docs-last-used-2026-07-21/`（11 个 .md，只读），重写一批精简的新当前文档：`00-README`/`01-current-status`/`02-architecture-and-data`/`03-deploy-and-servers`/`04-product-rules`/`05-next-actions`/`06-memo-tasks`/`CHANGELOG`。
- 新文档保留所有仍有效的关键内容：三条铁律、腾讯 Docker 部署流程（正式服+测试服）、服务器全景/密钥/踩坑、数据表/媒体链路/上传链路/资产分类、`getAssetIdentityKey` 去重规则、产品规则、活跃备忘 M001~M019。删去了已过时的马来 PM2 流程细节、逐条历史部署备份名、腾讯迁移过程流水（这些在归档里）。
- 归档文件夹 `historical-handover-docs-last-used-*` 只读，勿改勿删。更早还有 `historical-handover-docs-last-used-2026-06-20/`。

## 2026-07-21（部署 session：部署正式服 v1.0.0.34 + @引用资产滚动条常驻 + 修@引用资产重复视频/资产）—— ✅ 四方同步 v1.0.0.36 / `dd37a78`

**状态**：本对话按用户指令先把上一 session 的 v1.0.0.34 部署上正式服，又做两个 @引用资产弹窗改动并再次部署，最终四方同步 **v1.0.0.36 / commit `dd37a78`**（+ handover doc commit），四域名 200，无遗留。无本对话新增 Prisma 迁移。

### 1. 部署正式服 v1.0.0.34（上一 session 积压）
- 确认测试服=v34/正式服=v25/仅差迁移 `20260721000000_media_asset_duration_float` → 备份 → `rsync` staging→prod → `docker compose up -d --build flashmuse-app`（entrypoint 自动 apply 迁移，核验 `MediaAsset.durationSeconds`=double precision）→ 同步阿里正式镜像 → 四域名 200、公网 v1.0.0.34。正式服原样带 v34、未自增。
- 正式服 DB 跑 `scripts/backfill-prompt-mentions.js`（docker cp 进容器 `/app` 跑）：fixed=0 / alreadyOk=84 / skipped=3 / total=262（数据本就基本干净；3 个@名与参考图数量不匹配被安全跳过）。
- commit+push GitHub `8986fe1..5bb0fc2`（29 文件，含道具 prop_image 全套 + 工作流用量计数修复 + B_232/B_252 + 迁移 + `/api/generation-references`）。

### 2. @引用资产弹窗左侧分类"滚动条常驻"（v1.0.0.35，`asset-mention-picker.tsx`）
- 需求：新增道具分类后左侧显示不全，用户不想加高弹窗，要溢出时滚动条常显可下拉。
- 改：左侧分类 div 加类 `mention-cat-scroll` + 注入 `<style>`（`scrollbar-width:thin` + `::-webkit-scrollbar{width:8px}` thumb `#c7c7c7`）。用 `overflow-y-auto`（非 scroll，避免无溢出时占 gutter）——定义了 `::-webkit-scrollbar` 后浏览器改用非叠加式滚动条，溢出常驻可见、无溢出（如资产库生成弹窗 6 个图片分类）不显示。三处 @引用资产共用此组件=一处改全覆盖。

### 3. 修「@引用资产同一上传视频/资产显示成两个」（v1.0.0.36，`chat-workbench.tsx`）
- 现象（测试号 12424740 浏览器复现）：上传视频实际 2 个，点开 @引用资产 → `@1784181320556-1d99e327-c` 变两个共 3 个；回资产库刷新即恢复。
- 定位：服务端 `workspace-state?assetFilter=upload_videos` 只返回 2 条（干净）→ 前端 `assets` 里同一文件存了两份（一份 `<video>` 首帧无 posterUrl、一份 `<img>` poster，底层 url 相同）。
- 根因：`getAssetIdentityKey`(`chat-workbench.tsx:2617`) 原 `mediaId||归一化url||id`（mediaId 优先）。同一文件"消息内嵌引用(无 mediaId,key=url)"与"资产库懒加载权威记录(有 mediaId,key=mediaId)"两份 key 不同 → `loadMentionFilterPage` 合并时漏判成两条。
- 修：改成 **`归一化url||mediaId||id`（url 优先）**。url 是文件唯一身份 → 两份必合并（用带 posterUrl 权威版覆盖）。三处 @引用资产共用同一 `assets`+此函数+`isAssetInFilter`=一处改全覆盖所有分类（"上传图片"等同类隐患一并根治）。
- 验证：上传视频恢复 2 条无重复、上传图片首屏 30 无重复。

### 4. 部署正式服 v1.0.0.36 + push
- v35/v36 各 bump+打 patch 部署测试服验证 → 用户拍板部署正式服：备份 `/opt/flashmuse/app-backups/20260721-201737-presync-v36` → rsync→build→同步阿里正式镜像→四域名 200、公网 v1.0.0.36。commit+push `5bb0fc2..dd37a78`（3 文件：`asset-mention-picker.tsx`/`chat-workbench.tsx`/`app-version.ts`）。无 Prisma 迁移。
