# Keys And Integrations

## 集成概览

当前项目使用两套核心能力：

1. `OpenRouter`
2. `OpenRouter 视频生成`

另有一个 `MiniMax Coding Plan` 信息存在于外部记录里，但用户明确说：

- 第一个 MiniMax 不用管

所以当前项目没有使用 MiniMax。

## OpenRouter

用途：

1. 聊天理解
2. 上下文延续
3. 提示词优化
4. 意图分类

当前接法：

- 服务端调用 OpenRouter `chat/completions`
- 路由：`/api/chat`
- 意图分类路由：`/api/intent`
- 模型列表路由：`/api/models`

关键文件：

- `src/lib/openrouter.ts`
- `src/app/api/chat/route.ts`
- `src/app/api/intent/route.ts`
- `src/app/api/models/route.ts`

当前实现说明：

- `/api/chat` 根据 `mode` 切换系统提示词
- `agent` 模式用于创作推进、主动追问、剧本、分镜、提示词整理
- `chat` 模式用于普通自然对话，后端仍保留，但当前前端默认不再作为独立模式暴露
- `image` 模式用于结合上下文优化图片提示词
- `video` 模式用于结合上下文优化视频提示词
- `/api/chat` 会把 OpenRouter 返回的实际 `model` 字段带回前端
- `/api/models` 仍保留，但前端标题栏右侧模型下拉已移除
- `/api/intent` 会调用 OpenRouter，按最近上下文分类为 `agent` / `image` / `video` / `prompt` / `clarify`，用于 Agent 模式自动路由
- 当前对话模型固定为 `bytedance-seed/seed-2.0-lite`
- 曾误用 `seed/seed-2.0-lite`，OpenRouter 会报 invalid model ID，正确模型 ID 是 `bytedance-seed/seed-2.0-lite`
- `/api/intent` 已做轻量 JSON 结构化输出解析，失败时回退到 `agent`
- AI 回复当前使用轻量标记做排版：`#` / `##` / `###` 标题、`**加粗**`、`[red]...[/red]`、`[blue]...[/blue]`、`---` 分隔线
- Agent 回复会自行判断是否输出 `### 下一步调整方向`，可给 2-5 个选项，也可以没有；前端不再解析成按钮

## OpenRouter 视频生成

用途：

1. 视频生成

当前接法：

- `POST /api/video`
  - 如果传 `prompt`：创建 OpenRouter 视频任务
  - 如果传 `taskId`：查询 OpenRouter 视频任务
- 底层接入 OpenRouter 视频接口：
  - 创建：`POST https://openrouter.ai/api/v1/videos`
  - 查询：`GET https://openrouter.ai/api/v1/videos/{jobId}`
  - 当前模型：`google/veo-3.1-lite`

关键文件：

- `src/lib/openrouter-video.ts`
- `src/app/api/video/route.ts`

## 注意事项

### 1. OpenRouter 视频是异步任务模式

不是立即返回视频，而是：

1. 创建任务
2. 返回任务 id
3. 轮询任务状态
4. 成功后拿视频链接

当前轮询策略：

1. 前 2 分钟每 10 秒查一次
2. 2 分钟后每 30 秒查一次
3. 超过约 5 分钟提示重试

注意：OpenRouter 视频任务在 Node `fetch` 查询时遇到过假 `404 Not Found`，同一 URL 用 `curl` 可以正常返回 `completed`。因此 `src/lib/openrouter-video.ts` 里保留了 `curl` 兜底，不要轻易删。

### 2. Seedance 独立接口先暂停

之前从用户给的资料看，接口可能涉及 IP 白名单。

这意味着后续如果线上环境调用失败，需要优先检查：

1. 服务器 IP 是否已加白
2. 接口地址是否可达
3. 请求头鉴权字段是否完整

当前最新结论：

1. 已按 `E:\project\【1】Api\SeeDance接入说明\AI聚合三方接口接入文档.docx` 重接到 `/openApi/generate` 和 `/openApi/queryResult`
2. `.env.local` 当前 `SEEDANCE_BASE_URL` 使用 `http://14.103.147.238:19220`
3. 文档里测试环境写过 `http://8.137.157.96:9220`，但用当前 AK/SK 实测会返回 AK/SK 校验失败
4. 用 `http://14.103.147.238:19220` 实测会返回白名单错误，说明鉴权信息更匹配这个环境
5. 当前先不继续处理白名单，等后续部署服务器时再接 Seedance 独立聚合接口
6. 本地 MVP 阶段优先走 OpenRouter 视频模型

### 3. 图片生成已接入

当前图片生成通过 OpenRouter 图片模型接入。

当前默认图片模型：

1. `bytedance-seed/seedream-4.5`

当前默认视频模型：

1. `google/veo-3.1-lite`

说明：

1. 图片模式会先通过对话模型优化提示词
2. 然后调用 `/api/image` 生成图片
3. 生成结果会保存到 `public/generated/images`
4. 图片生成实际请求只传 `modalities: ["image"]`；不要传 `modalities: ["image", "text"]`，否则 `bytedance-seed/seedream-4.5` 会报没有支持端点
5. 视频生成当前在 `src/lib/openrouter-video.ts` 使用集中常量 `DEFAULT_VIDEO_MODEL`，实际强制 4 秒、720p
6. 图片 / 视频模式里的“普通图片模型 / 普通视频模型”当前只是前端占位，还未接真实可选模型列表
7. 聚合接口文档位置：`E:\project\【1】Api\SeeDance接入说明`

## 敏感信息说明

当前 `.env.local` 里已经写入敏感信息。

这只是当前本地开发为了快速推进使用。

GitHub 同步规则：

1. `.env.local` 不上传 GitHub
2. `.env.example` 可以上传，只保留变量名和非敏感默认模型配置
3. 换电脑后复制 `.env.example` 为 `.env.local`，再手动填写 `OPENROUTER_API_KEY`
4. Seedance 独立聚合接口当前暂停，本地 MVP 阶段不填 Seedance 也可以继续使用 OpenRouter 对话、图片和视频链路

后续建议：

1. 本地继续用 `.env.local`
2. 服务器改成真正的环境变量
3. 不要把这些 key 暴露到前端
