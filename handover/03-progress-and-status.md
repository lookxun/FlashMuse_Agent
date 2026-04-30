# Progress And Status

## 当前已完成内容

### 1. 项目初始化

目录：`E:\project\AI-Video-Assistant`

已使用 `create-next-app` 初始化。

### 2. 首页工作台

已实现一个改版后的聊天工作台：

- 左侧固定侧栏
- 右侧主聊天区
- 顶部对话模型选择已移除
- 默认 `Agent 模式`
- 输入模式为 `Agent 模式` / `图片模式` / `视频模式`
- 输入框
- 发送按钮
- 图片和视频结果直接显示在对话流里
- 输入框固定在底部
- 左侧增加模式选项卡占位：对话模式 / 工作流模式 / 资产管理
- 右侧顶部 60px 固定标题栏，显示当前对话名称
- 标题栏支持当前会话重命名
- 标题栏支持收起 / 展开左侧栏
- 输入框下方工具栏支持 `+` 上传入口、模式自定义上弹菜单、参数按钮、发送按钮
- `+` 按钮可选择本地图片，并在输入框上方以约 100x100 预览
- 输入框支持粘贴图片，上传和粘贴图片最多 5 张，超过时显示黑色提示“最多上传五张图片”
- Agent 模式不显示生成参数
- 图片模式显示普通图片模型占位、比例、分辨率、风格参数
- 视频模式显示普通视频模型占位、比例、分辨率、风格、时长参数
- 参数按钮统一为 12px 字体，菜单向上弹出
- 参数菜单向上弹出，宽度跟随按钮
- 输入框外层为 ChatGPT 风格白色胶囊、灰色描边和轻阴影
- 输入框 placeholder 当前为 `发送消息...`，输入文字和 placeholder 当前强制为 14px
- 输入框支持 Enter 发送，Shift + Enter 换行
- AI 回复支持富文本排版：标题、分段、列表、加粗、淡红 / 淡蓝提示块、灰色分隔线
- Agent 按上下文判断是否输出“下一步调整方向”，数量可为 2-5 个，也可以没有；前端不再渲染额外方向按钮
- 每个历史会话拥有独立输入草稿、上传图片和生成状态
- 不同历史会话可以并发生成，当前会话的发送按钮只受当前会话生成状态影响
- AI 新回复支持逐字打字机效果，按字数控制在 1-8 秒内，旧历史消息不重新打字
- 左侧历史会话生成中会在标题前显示光环扩散动画，“映造正在思考”前也显示同款动画
- AI 头像统一为左上角同款圆角方形 MoonStar 风格
- 用户消息气泡和图片 / 视频卡片圆角统一为 12px
- AI 回复底部有反馈操作区：复制、重新生成、喜欢、不喜欢、回答不对 / 要图给视频或要视频给图、更多
- 反馈按钮悬停显示黑底白字 tooltip；复制成功显示 1 秒对勾，失败显示 1 秒 X 和“无法复制”
- 反馈区更多菜单支持“复制文字”和“删除”，菜单样式与左侧三点菜单一致
- 反馈区末尾显示 12px 灰字“映造感谢反馈 + 消息时间”，格式如 `2026/4/29 20:10`
- 上传 / 粘贴图片会随用户消息进入对话流，Agent 可做图片理解，图片模式可参考图生图，视频模式可按首帧 / 视觉参考生视频
- 用户说“刚才那张图、图中、让它动起来、首帧”等，会自动取最近对话图片作为参考
- Agent 自动路由已收紧，“看看 / 分析 / 点评 / 识别图片”不会误触发生图
- 发送后用户消息会立即显示，输入框立即清空，按钮显示 `发送中...`，避免用户误以为卡住重复点击
- 同一会话发送中会防重复，同一请求回复会防重复，避免一条用户消息出现多条 AI 回复
- Agent 简单问候走本地短回复，Agent 提示词已收紧为默认一问一答，不随便分段和输出多个追问
- 左侧栏品牌文案已改为“映造 / AI影片助手”，Logo 底色 `#6667ff`、图标白色
- 左侧“开启新对话”已改成“新建对话”，使用 `Plus` 图标，文字居中且图标在居中文字左侧
- 左侧历史选中态多次尝试后已按用户要求回到最初灰色 `#ececec`
- 图片 / 视频生成请求发出后会立即显示状态卡片，不再等提示词优化或任务创建完成
- 图片 / 视频生成中状态卡片为 400x400、12px 圆角、蓝紫青渐变随机运动动画，左上角显示生成 / 渲染中百分比，底部显示状态和已等待时间
- 图片 / 视频生成中不再额外显示“映造正在思考”
- 视频生成完成后会直接在对话流中显示内嵌视频卡片，不再显示“打开视频”按钮
- 视频卡片按比例缩小展示，最大高度约 520px，保留播放器控件；鼠标悬停自动播放，移开自动暂停
- 刷新浏览器后会恢复刷新前所在历史对话，当前会话 ID 保存在 `yinzao-active-session-v1`
- Agent 模式在意图识别阶段会立即显示“映造正在思考”，避免等待 `/api/intent` 时页面无反馈；识别到图片 / 视频后再显示对应等待卡片

主要文件：

- `src/app/page.tsx`
- `src/components/chat-workbench.tsx`

### 3. OpenRouter 接入

已完成：

- 服务端封装 OpenRouter 请求
- 前端发送消息后调用 `/api/chat`
- `/api/chat` 支持 `agent` / `chat` / `image` / `video` 四种模式
- Agent 模式返回创作推进、追问、剧本 / 分镜 / 提示词建议
- 普通 `chat` 模式仍保留在后端，但当前前端默认不再作为独立模式暴露
- 图片 / 视频模式返回优化后的提示词文本
- `/api/chat` 会返回 OpenRouter 响应里的实际 `model` 字段
- 新增 `/api/models` 拉取 OpenRouter 文本模型列表，但当前前端已移除顶部模型下拉
- 新增 `/api/intent`，使用 OpenRouter 做结构化意图分类，返回 `agent` / `image` / `video` / `prompt` / `clarify`
- 对话模型固定为 `bytedance-seed/seed-2.0-lite`
- 修复过错误模型 ID：`seed/seed-2.0-lite` 无效，OpenRouter 正确前缀是 `bytedance-seed/`
- Agent 模式会先走本地硬规则，再走本地纠错记忆，再走 `/api/intent` 分类；明确生图 / 生视频时自动切到对应生成流程
- 图片 / 视频模式获取优化提示词后不再先把提示词展示给用户，而是直接进入生成

相关文件：

- `src/lib/openrouter.ts`
- `src/app/api/chat/route.ts`
- `src/app/api/intent/route.ts`

### 4. 视频任务接入

已完成：

- 服务端 OpenRouter 视频创建任务
- 服务端 OpenRouter 视频查询任务状态
- 前端在“视频模式”下提交视频任务
- 前端轮询任务状态
- 对话流里显示视频任务状态和视频链接
- 当前已切到 OpenRouter 视频接口
- 创建接口：`POST /api/v1/videos`
- 查询接口：`GET /api/v1/videos/{jobId}`
- 请求模型：`google/veo-3.1-lite`
- 请求结构：`model`、`prompt`、`duration`、`resolution`、`aspect_ratio`、`frame_images`
- 状态映射：`pending=queued`、`in_progress=running`、`completed=succeeded`、`failed=failed`
- Seedance 独立聚合接口因白名单和后续部署问题先暂停
- 当前视频生成已切到 OpenRouter 视频接口 `/api/v1/videos`
- 默认视频模型后续改为 `google/veo-3.1-lite`
- OpenRouter 视频接口是异步任务模式：创建任务后轮询 `GET /api/v1/videos/{jobId}`，完成后取 `unsigned_urls` 保存到本地
- 视频生成当前强制 4 秒、720p，提高成功率和速度
- 短视频提示词会先由 `/api/chat` 扩写；如果仍过短，`src/lib/openrouter-video.ts` 会再次兜底扩写
- 视频轮询策略：前 2 分钟每 10 秒查询一次，之后每 30 秒查询一次，超过约 5 分钟停止并提示“这个任务排队太久，建议重试。”
- 重要技术坑：OpenRouter 视频任务直接用 Node `fetch` 查询时可能返回假 `404 Not Found`，但 `curl` 能查到 `completed`；当前 `getOpenRouterVideoTask` 已加 `curl` 兜底
- OpenRouter 返回的 `unsigned_urls` 内容地址需要鉴权；当前保存视频时如果 Node `fetch` 失败，会用 `curl` 带 OpenRouter headers 兜底下载

相关文件：

- `src/lib/openrouter-video.ts`
- `src/app/api/video/route.ts`
- `src/components/chat-workbench.tsx`

### 5. 图片生成和本地历史

已完成：

- 新增 `/api/image`
- 图片模式会调用 OpenRouter 图片模型生成图片
- 图片结果改为直接显示在对话流里
- 左侧会话列表改为真实会话
- 会话、聊天内容、图片结果、视频任务状态保存到浏览器本地
- 图片模式现在会把比例、分辨率、风格参数传给提示词优化阶段
- 图片生成请求已从 `modalities: ["image", "text"]` 改为 `modalities: ["image"]`，避免 `bytedance-seed/seedream-4.5` 报不支持 `image, text` 输出
- 当前图片 / 视频专业模型选择只是占位，真实模型列表和参数接入还未完成
- 本地反馈日志保存在 `localStorage` 的 `yinzao-feedback-log-v1`
- 本地意图纠错记忆保存在 `localStorage` 的 `yinzao-intent-memory-v1`
- 当前所在历史对话保存在 `localStorage` 的 `yinzao-active-session-v1`

相关文件：

- `src/app/api/image/route.ts`
- `src/lib/openrouter.ts`
- `src/components/chat-workbench.tsx`

### 6. 环境变量

已创建：

- `.env.local`

当前已写入：

- OpenRouter key
- Seedance base url
- Seedance projectCode
- Seedance access key
- Seedance secret key

注意：

- 这属于敏感信息
- 后续正式部署时应迁移到服务器环境变量或安全存储

### 7. 启动脚本

当前只保留一个根目录启动脚本：

- `start-project.bat`

用户反馈：

- `vbs` 版本不稳定，已弃用
- `start-project-hidden.bat` 和 `start-project-no-window.bat` 已删除
- 当前推荐双击 `start-project.bat`
- 项目目录曾短暂改为带空格的 `AI Video Assistant`，导致 PowerShell 二次启动路径解析问题；已改为无空格目录 `AI-Video-Assistant`
- `scripts/start-project.ps1` 已对脚本路径加引号处理，避免路径含特殊字符时启动失败

## 当前待完成内容

优先级最高：

1. 完善 Agent 模式：生成前确认、自动生图 / 生视频、剧本 / 分镜结构化能力
2. 完善图片 / 视频模式：真实模型选择、提示词不明确时的优化确认、参数真正接入接口并验证平台支持
3. 实测 OpenRouter 视频生成完整成功链路，并继续完善视频参数和模型选择
4. 增加并发生成的队列、限流、失败重试和错误提示优化
5. 服务端数据库持久化
6. 完善反馈系统：不喜欢 / 回答不对 / 模式错了弹窗收集原因，反馈日志查看页，自动总结反馈规则

第二优先级：

1. UI 继续细抠到更接近 ChatGPT 风格参考页
2. 会话删除和重命名继续细化
3. 工作流模式占位改成功能页

第三优先级：

1. 资产管理页
2. 登录系统
3. 正式部署

## 当前测试方式

推荐启动方式：

- 双击 `start-project.bat`
- 当前项目目录为 `E:\project\AI-Video-Assistant`

如果改了这些内容，建议重启项目再测：

1. `.env.local`
2. `api` 路由
3. 服务端逻辑

如果只是改页面样式，通常刷新即可。
