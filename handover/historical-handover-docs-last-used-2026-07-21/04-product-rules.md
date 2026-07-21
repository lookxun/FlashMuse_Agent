# Product Rules

## Product Shape

- Product name: `闪念 / FlashMuse`.
- Goal: internal simple Jimeng-like creative assistant for chat-based image and video generation.
- Main modes: Agent/general chat, image generation, video generation, asset library, and workflow code behind a production feature gate.
- Production workflow entry stays disabled unless the user explicitly asks to open it.

## 铁律：能统一的一律统一（禁止同一逻辑复制多份各走各的）

- 各模式（对话流 / 工作流 / 资产库 / Agent / 通用）本质相同，功能不多。写/改代码前**先查有没有统一公共路径**，有就复用、没有就抽一个。
- **绝不允许把同一段逻辑复制成多份各自演化**。已踩坑：`getBytePlusProviderKey` 复制三份，只修对话流那份 → Agent/通用生图/生视频用新模型直接失败。已统一为 `src/lib/byteplus-provider-key.ts`。
- 标准：**一处能用，其它处都该能用**（生图/生视频/上传/进库/读取/命名/扣费/参考图）。出现"对话流行、Agent 不行"就是分叉了，先收敛别打局部补丁。
- 新增模型/模式：只改统一函数 + `system-settings.ts` 配置表，且**对称补齐所有前缀**（conversation-image / asset-image / agent-image / video / agent-video）。
- 详见 `AGENTS.md` 顶部同名铁律。

## Deletion Rule

- User deletion is soft deletion.
- Generated files and database records should be retained for support recovery.
- UI can say deleted or 30-day cleanup to users, but backend should not physically delete media files under current product rule.

## Asset Rule

- User asset library currently exposes only role, scene, and shot image categories.
- The user-facing asset sidebar currently shows `角色图片 / 场景图片 / 分镜图片 / 上传图片`, then a divider, then `对话流资产` with generated image/video categories.
- `上传图片` is a unified upload category. Asset-library uploads, conversation uploads, and future workflow uploads all belong there.
- Uploaded images should not ask for category at upload time.
- Role, scene, and shot categories keep only their generation buttons; the upload button appears only in the `上传图片` category.
- Conversation generated images are not considered currently selected under `上传图片` in the move menu. They show no checkmark and can be moved to any target.
- Actual uploaded images show the checkmark on `上传图片` in the move menu.
- Moving any image to `上传图片` should write `currentCategory="conversation_uploads"`.
- Conversation uploads, conversation images, and conversation videos are data categories, but the UI groups uploads visually above the conversation generated categories.
- The asset sidebar should show `工作流资产` below `对话流资产`, with subcategories `生成图片` and `生成视频`. These map to `workflow_images` and `workflow_videos`. Workflow assets must not be counted or displayed as conversation assets.
- Do not classify uncertain conversation media into user asset categories by prompt guessing.
- If recovering or migrating assets, prefer reliable sources in this order: `WorkspaceMessage`, then `CreditLedger.metadata`, then old workspace assets.
- All generated images/videos and uploaded images are assets. Future uploaded videos should also be treated as assets. Current Seedance reference audio/video uploads are reference files stored under user `files`; they must be preserved in messages and requests even if they are not yet user-facing asset-library categories.
- Current rule after 2026-06-23 deploy: uploaded videos, uploaded audios, and uploaded documents are also table-tracked assets. They are saved under `/generated/users/{userId}/files/...` and written into `MediaAsset + UserAssetState` with internal categories `conversation_upload_videos`, `conversation_upload_audios`, and `conversation_upload_documents`. User-facing asset-library groups for these categories are not added yet.

## Reference Image Rule

- Explicit `@资产名` controls reference images and order.
- Without explicit `@`, use current uploaded/reference images or recent context according to current code.
- Avoid duplicate reference URLs before sending to model.
- The `@` menu intentionally shows only role, scene, shot, and upload-image groups to avoid large-menu lag. Manually typed `@` may still resolve other existing conversation references when the code supports them.
- Uploaded reference audio/video files can be mentioned with `@文件名` in video prompts. If the user does not manually place the mention, the client prepends missing media-file mentions to the prompt before sending.

## Conversation Input Rule

- The long conversation input editor should preserve the user's scroll/caret context. If the user scrolls upward inside the input box, typing, newline, paste, deleting mention spans, or inserting `@` references must not force the input content/caret to jump to the bottom.
- If the input editor is already at the bottom, continued typing should keep following the bottom normally.
- Conversation-flow image upload cards show a generic white `上传失败` overlay for upload failures, except upload timeout errors. If `image.error` contains `上传超时`, the card white overlay should show `上传超时`. Other failure causes such as JPEG re-encode needed, server 500, or generic upload failure should still show `上传失败` on the card while detailed diagnostics are recorded in logs.
- Conversation-flow image upload XHR timeout is currently `90 * 1000` ms. Upload progress intentionally caps at 95 until the server responds; if it stays at 95 until the XHR timeout, the card changes to `上传超时`.
- Conversation-flow image upload should automatically retry once with `forceReencode=1` when the server says `图片编码需要转码`. The user should not have to manually retry just because a JPEG needs server-side re-encoding.
- Production browser image uploads may use `https://api.venusface.com` from Ali/static pages with `/api/upload-token` Bearer auth. Keep `/api/asset-upload-temp` CORS aligned for the VenusFace domains when changing upload hosts.
- Conversation-flow BytePlus `Seedance 2.0` / `Seedance 2.0 Fast` video mode uses an explicit `参考模式` menu in the input toolbar. Do not infer `首帧模式` or `首尾帧模式` from prompt words anymore for new sends. The menu appears only when the current conversation mode is `video` and the selected model is one of the two BytePlus Seedance models. Default is `融合模式`. The menu options/icons/descriptions are: `融合模式` with `image-circle-line`, gray text `支持 1-9 张图片，1-3 个视频，1-3 个音频`; `首帧模式` with `image-2-line`, gray text `支持 1 张首帧图片`; `首尾帧模式` with `multi-image-line`, gray text `支持 2 张图片：首帧和尾帧`.
- Conversation-flow Seedance selected reference mode must be sent to `/api/video` as `referenceMode`. `融合模式` sends `reference`, `首帧模式` sends `first_frame`, and `首尾帧模式` sends `first_last_frame`. Upload rules, submit validation, replay/regenerate, and Agent/General-to-video generation should use this explicit selected mode. First-frame mode requires at least one image; first-and-last-frame mode requires at least two images. These two image-to-video modes must not allow reference video/audio uploads.

## Upload Rule Configuration

- Admin `上传规则` now has two layers. The editable table at the top is the effective priority source for upload counts, and the old text/table rules below it are fallback/reference only.
- Editable upload count settings are stored in local/server environment value `UPLOAD_RULE_OVERRIDES` through `src/app/admin/api/upload-rules/route.ts` and helper functions in `src/lib/system-settings.ts`. There is no Prisma table for this as of 2026-06-30.
- Runtime rule resolution is: `UPLOAD_RULE_OVERRIDES` first, then static fallback from `src/lib/upload-rules.ts`. If an override is missing for a model/type, fallback rule applies.
- All generation upload paths should use this priority rule source: conversation input, asset-library generation input, workflow input, `/api/chat`, `/api/image`, and `/api/video`. Do not add new upload-count checks that bypass `getUploadRule(..., overrides)` or `validateReferenceImageCount(..., overrides)`.
- The editable table has one unified row for all conversation/chat models. OpenRouter image/video models have one row per model. BytePlus image models have one row per model. BytePlus Seedance video models are unified by mode, not by model.
- BytePlus `Seedance 2.0` and `Seedance 2.0 Fast` share three upload rule keys/modes: `融合模式` (`reference`), `首帧模式` (`first_frame`), and `首尾帧模式` (`first_last_frame`). Default fallback image counts are `9`, `1`, and `2` respectively. Both BytePlus video models use these rows.
- GPT-5.4 Image 2 document/file input is not implemented. It should display `不支持` and be treated as unsupported in effective upload rules unless real file-input support is implemented later.
- Workflow upload button count labels such as `1-9` must reflect the current effective rule, including admin overrides and selected BytePlus Seedance mode. After changing admin upload rules, the workspace/frontend needs a refresh or model-availability reload to receive the new `uploadRuleOverrides`.

## Diagnostics Rule

- Detailed provider/generation diagnostics are now written to `.runtime/generation-diagnostics-log.jsonl`. Do not commit or paste full sensitive log content into docs. It should be used to diagnose model/provider status, request IDs, upstream errors, timeouts, and media-save problems.
- Detailed upload diagnostics are now written to `.runtime/upload-diagnostics-log.jsonl`. Use it together with Nginx access logs to distinguish network timeouts (`408`/`499`), JPEG re-encode-needed failures, ffmpeg/server failures, and successful retries.
- Diagnostic logging must remain best-effort/non-blocking and must redact API keys/tokens/signed URLs. Remote URLs should be summarized by host/path tail, not fully persisted into docs.

## BytePlus Seedance Video Rule

- Normal multi-reference video mode uses only `reference_image`, up to 9 images.
- Explicit selected first-frame mode uses only the first image as `first_frame`.
- Explicit selected first-and-last-frame mode uses first image as `first_frame` and second image as `last_frame`; fewer than 2 images should block with a friendly prompt.
- Standalone tail-frame wording must not switch modes. Conversation flow no longer infers Seedance reference mode from wording; workflow flow uses its explicit mode selector.
- Do not mix `first_frame`, `last_frame`, and normal `reference_image` in the same BytePlus request.
- Seedance 2.0 / Fast reference videos and audio are supported only for BytePlus video fusion/multimodal reference mode. First-frame and first-and-last-frame modes support images only. Reference videos use `reference_video`; reference audio uses `reference_audio`.
- Reference video/audio uploads should render as file-style cards in the input. While uploading, clicking the card should only show `文件上传中`; once uploaded, clicking the input card inserts `@文件名` rather than opening preview.
- Sent prompt text should render media mentions in blue with a small audio/video icon. Only the icon opens the preview player.
- Replay/regenerate and failed-video retry must keep uploaded `referenceVideos` and `referenceAudios`, not just image references.

## BytePlus Human Reference Review

- Human/privacy reference image failures can trigger automatic BytePlus asset review for Seedance models.
- Submit saved local HTTPS `/generated/...` URLs where possible, not expired remote provider URLs.
- Failed review state should be written back so the same image does not infinitely retry.
- Current rule allows up to 3 automatic review attempts.
- User-facing review copyright rejection text differs from output-video copyright rejection text.
- Whenever a new image enters automatic BytePlus review, the UI should add the blue system notice `系统检测到真人图片，需要审核才能生成视频，此次视频生成任务会延长时间，请稍候....`. De-duplicate within the same video request only, not across the whole conversation.

## Credits And Billing

- `CreditLedger` is the billing source.
- Text costs can accumulate fractional credits in `User.textCreditRemainder`.
- Image/video media costs are shared onto `MediaAsset` rows when media can be matched safely.
- Prompt optimization, reverse prompt, and normal text ledgers are not media costs.

## Workflow Rule

- Conversation mode and workflow mode are different UIs over the same generation, saving, billing, and asset persistence chain.
- A first-time workflow workspace should have one untitled `新工作流`, just as a new conversation workspace starts with one empty conversation.
- Clicking `新建工作流` while an untitled `新工作流` already exists must select that existing item, not create another one.
- `新工作流` receives a numbered title only after real canvas action. The automatic names are `工作流_01`, `工作流_02`, etc. Deleted numbers are not reused; persist and honor `nextWorkflowNumber`.
- A workflow whose nodes were created and later deleted is not a `新工作流` anymore if it already has a numbered title. It should not block creating a new untitled workflow.
- Workflow sidebar loading mirrors conversation history basics: show 10 items first and load 5 more at a time.
- Workflow image/video nodes should use the same enabled model lists as conversation image/video generation. Backend model availability switches must affect both UIs.
- Current local workflow text nodes are `文本输入` nodes, not Agent text-generation nodes. They are saved long-text input boxes for prompts/scripts and have no model menu or generate button. Image/video nodes may consume upstream text-input node content as prompt context.
- Workflow text input content must be persisted while the node still exists, not only when the node is deleted. The primary source is `WorkspaceWorkflow.canvasJson.nodes[].data.text` plus `data.prompt`. `historicalTextNodes` is only a recovery/history fallback for non-empty text nodes that are deleted or disappear from the current tldraw page. Empty text nodes should not enter history.
- Workflow historical text nodes should be de-duplicated by trimmed text content, normalizing CRLF to LF. If two deleted text nodes have identical content, keep only one history entry, preferably the newest. Text history delete removes the history entry from current workflow state only; it must not physically delete database rows or generated files.
- Workflow history should persist in `WorkspaceWorkflow`, mirroring conversation history tables rather than relying on `UserWorkspaceState.state.workflowItems`. Deletion is soft deletion with `deletedAt`; absent items in partial client payloads must not be treated as deletions.
- Workflow node media cards should display thumbnails/poster thumbnails. Preview opens via the node card's bottom-right eye button because the card itself is used for selection and dragging. Preview modal should use the original image/video URL.
- Workflow media naming must match conversation media naming semantics but use workflow codes. `工作流_01` maps to `w1`, `工作流_02` maps to `w2`; generated workflow media names are `image_N_wX` / `video_N_wX`. Counters are independent per workflow, successful generations fix the name permanently, and failed generations do not consume a number.
- Workflow generated media must persist the same important generation and media fields as conversation media: prompt/sourcePrompt, model, ratio, resolution, duration, dimensions, durationSeconds when known, poster, workflowId, workflowNodeId, workspaceKind/workspaceId, stable system name, generationSettings, and preview metadata. Generation parameter ratio must remain a supported model ratio such as `16:9`; actual pixel dimensions like `2848 x 1600` belong in `imageDimensions`, `videoDimensions`, `width/height`, `visualSize`, or preview size text, not in `data.ratio`.
- Workflow generated media must be written to the current node immediately on success for self-preview. A generation result belongs to the node that generated it and must not overwrite sibling nodes. Use latest canvas state when async generation completes.
- Workflow right-side preview thumbnails must be scoped to the current workflow canvas. They should show only images/videos currently displayed in that workflow's nodes, not old hidden/history assets or other workflows' assets.
- Workflow node cards must remain draggable regardless of state: empty, waiting, success image/video, or failed. Embedded media should not trigger browser drag-download; use `draggable={false}` on generated images/video posters.
- Workflow layer rows for non-empty text and generated image/video nodes may expose lock and visibility controls. Lock state should use tldraw shape locking and persist as workflow node data. Hidden state should use tldraw `getShapeVisibility`, not ad-hoc CSS hiding, and persist as workflow node data while the layer row remains visible so the user can show it again. Current UI rule is mutually displayed controls: normal hover shows lock and eye; locked rows show only lock/unlock; hidden rows show only show/hide. Canvas selection and layer-panel selection must stay synchronized; use narrow tldraw selection syncing only, not full-store autosave.
- Workflow text input nodes use tldraw editing state: normal click/drag moves/selects; double-click or Enter enters editing mode for typing, paste, delete, select/copy, and scrolling; Escape/canvas click exits editing. Double-click also focuses/zooms to the text node. Text input nodes should keep title `文本输入（双击进入编辑模式）`, `RiTextBlock` icon, default `720x480`, white background, rounded `20px`, and `5px #b8b8b8` border unless the user changes this visual rule.
- Workflow generated image/video nodes are resizable only after generation. Resize must keep aspect ratio, max at natural/real media size, min at longest edge `256px`, persist current `visualSize`, and update the selected-node size label live. Regenerating media should clear old visual size.
- Workflow video nodes should not loop playback. Saved local video nodes may record `videoCurrentTime`; export should use the recorded local video frame when the URL is local `/generated/...`, while remote temporary video should export poster only.
- Workflow video nodes should read browser video metadata on `loadedmetadata` and persist `videoDimensions` / `durationSeconds` back into node state and `MediaAsset` when available. Video hover cursor should remain normal/default, not disabled; prevent browser drag-start on generated video elements and overlays.
- Workflow tldraw right-click menu should be a workflow-owned custom menu, not tldraw's default `DefaultContextMenu`. The default menu conflicted with complex HTML custom shapes after blank-click close, and remounting it caused canvas lag. The workflow custom menu should stay about `180px` wide and call tldraw `useActions()` / editor APIs for cut, copy, paste, duplicate, delete, layer order, copy/export SVG/PNG, select all, and the workflow-specific `下载`. Actions that create/change/delete/reorder workflow nodes must continue to sync through narrow `editor.sideEffects` handlers for `workflow_node`, not broad full-store autosave.
- Workflow context menus should hide invalid actions instead of showing disabled rows. Empty canvas right-click should offer valid canvas actions and node insertion. Empty nodes should not show export/download/media-specific actions. Generated image/video node menus should include `使用提示词`; this creates a new same-kind node and preserves prompt, `@` mentions, uploads, and generation parameters, but not generated result media/state. Generated image export should include SVG/PNG/JPG; generated video export should include first frame, last frame, and current frame.
- Workflow uses one tldraw page per FlashMuse workflow. Do not expose or use tldraw multi-page commands such as `MoveToPageMenu` / `move-to-new-page`; they move shapes to another tldraw page and are incompatible with `WorkspaceWorkflow.canvasJson`.
- Workflow custom shapes need `toSvg()` support for tldraw export/copy image actions. Text exports as SVG text/rect; image exports should embed fetched media as a data URL; video export should use saved local current frame, then poster, then placeholder. Context-menu `下载` should download one selected workflow node: text as `.txt`, image as image source, video as video source.
- Workflow tldraw default snapping/reference lines should stay enabled for local workflow by `editor.user.updateUserPreferences({ isSnapMode: true })`. This uses tldraw's built-in shape bounds/center snapping first. Do not add custom snapping geometry unless the user asks for special snap points such as ports or fixed spacing.
- Workflow input behavior should match conversation input: `Enter` sends/generates, `Shift+Enter` inserts a newline, and IME composition should not trigger send.
- Future workflow upload entries should consistently use these Remix icons: uploaded image `image-line`, uploaded video `video-on-line`, uploaded audio `voiceprint-line`, uploaded file/document `file-text-line`. When uploaded items are later shown as workflow nodes, the node top-left should show the matching icon, then the title `上传图片` / `上传视频` / `上传音频` / `上传文件`, then the file name. Uploaded image and uploaded video nodes should also show the real media size on the right, following the generated image/video node size display rule.
- Workflow node prompt input should reuse conversation input behavior, not a simplified textarea clone. Manual `@` should open the same reference asset flow and filter by typed query; arbitrary `@text` must not become blue. Only real matched references should render blue. Do not re-render the contenteditable DOM on every input just because `@` text exists, because that breaks text selection and cursor stability.
- Workflow image/video node prompt input should stay inside the workflow canvas viewport, not page/sidebar coordinates. It should remain in the node-below direction, may overlap the node, should not jump above the selected node, and should keep about 8px above the bottom workflow dock. When long text reaches the dock boundary, the box bottom should stay fixed and the top may expand upward; only the central prompt editor should scroll. Workflow prompt/upload/input limit messages should reuse the conversation black `ReminderToast` behavior instead of inline error text inside the prompt panel.
- Workflow upload chips above the node input are a UI split of the conversation `+` upload function. `图片 / 视频 / 音频 / 文件` should each open a file chooser filtered to only formats supported by the current node kind/model upload rule and show the supported count range from upload rules. Images use the conversation-style `/api/asset-upload-temp` chain with XHR progress, 90-second timeout, `PATCH` commit to durable URL, and automatic `forceReencode=1` retry when JPEG re-encode is required; video/audio/document files use `/api/upload-file`. Uploaded node attachments should be available to generation like conversation attachments: uploaded images can feed text/image/video nodes, uploaded video/audio can feed video nodes, and uploaded audio alone must still be rejected by the video API unless paired with image/video reference. Switching models should remove current uploads unsupported by the new model and remove their `@文件名` mentions.
- Workflow upload cards should match the upload-button footprint. Image/video/audio/file uploaded cards are `64x70`; image/video use thumbnails with bottom `@文件名`, video includes a centered play icon, audio/file use white card with gray border, centered icon, and the same bottom `@文件名` positioning. Remove `X` should be a separate black circular button outside the clipped card content; removing an upload also removes its prompt mention. Durable URLs must be preferred over stale `blob:` preview URLs after refresh.
- Workflow reference asset popup should use the same four user-facing groups as conversation mode: `角色图片 / 场景图片 / 分镜图片 / 上传图片`. It must call the same asset-loading path when opened so it does not show empty lists just because the asset categories were not preloaded. Selecting an image asset should add both the image card and the `@文件名` mention, matching conversation mode. Opening the reference popup must not reorder the global asset library; loaded mention assets should update existing records in place and append only missing records.
- Workflow upload validation should stay aligned with conversation upload validation. Workflow must validate format, size, count, video/audio single duration, video/audio total duration, video dimensions, video aspect ratio, video total pixels, upload-in-progress/error state, and audio-only video requests before generation.
- Once a video generation task id exists, transient polling failures must not immediately turn into a failed card. This applies to conversation and workflow. Network interruptions, browser refreshes, PM2/deploy restarts, and temporary `408/409/425/429/500/502/503/504` poll responses should keep the waiting/running card and continue/recover polling. Only explicit provider failure states (`failed`, `error`, `expired`), unrecoverable create-stage errors, invalid parameters, auth/credit failures, or completed-without-video-url should display a failed card. Backend `errorCode` must be preserved in the user-visible message as `(B_xxx)` when present.
- BytePlus Seedance input moderation for真人/隐私 sensitive references must cover all reference media types, not only images. If BytePlus create returns input image/video/audio sensitive content or real-person/privacy errors, `/api/video` should first return `status="reviewing"` when `autoBytePlusAssetReview` is false, then on retry create/reuse BytePlus assets for images, videos, and audios with matching `AssetType: Image | Video | Audio`, wait for Active, and retry generation using `asset://...` references. This rule was added after production `B_254`, where a reference video `下载.mp4` triggered `InputVideoSensitiveContentDetected.PrivacyInformation` while image-only auto review was insufficient.
- Workflow BytePlus `Seedance 2.0` / `Seedance 2.0 Fast` video nodes have an explicit reference-mode menu in the prompt box before the send button. The menu options are `融合模式`, `首帧模式`, and `首尾帧模式`; the selected value persists on `WorkflowNodeData.videoReferenceMode`, controls upload button support/count labels, prunes excess uploads when switching modes, and is sent to `/api/video` as `referenceMode`. New workflow video nodes default to `融合模式`. Only `融合模式` shows video/audio upload support; `首帧模式` and `首尾帧模式` show image upload only and must prune video/audio uploads plus their `@文件名` mentions. `首帧模式` upload button label is `首帧` and send stays disabled until one ready image/reference exists. `首尾帧模式` upload buttons are `首帧` and `尾帧`, and send stays disabled until two ready images/references exist. These two modes do not show `1-1` / `1-2` count text on the image buttons.
- Workflow input-box menus should close when the user clicks/focuses another non-menu area inside the same prompt box, matching conversation input behavior. Menu-internal clicks must not close the menu before the selected action runs.
- Workflow `GPT-5.4 Image 2` AI safety rewrite retry must use minimal-patch prompt editing. It is not general prompt optimization and must not rewrite the whole scene on early attempts. Preserve all `@` references, user intent, scene, action, props, and reference image identity/clothing as much as possible. First attempt should add only a very short safety phrase where possible, such as `穿日常连衣裙`, `穿着得体`, or `自然生活照风格`. Later attempts may gradually add slightly stronger safety wording, but still should avoid replacing the user's outfit, scene, or subject with a different safe alternative unless absolutely necessary.

## Auth Session Rule

- Normal user login is idle-based, not 30-day persistent login.
- Local development and production intentionally differ here: local development login idle timeout must stay 24 hours, while production must stay 1 hour unless the user explicitly changes the online rule.
- Real user actions such as click, keyboard, wheel, touch, or scroll call `/api/auth/activity` and extend the session.
- Routine background auth checks, workspace-instance checks, autosave, and media polling must not extend idle expiry.
- Active generation waits are treated as activity. While any conversation, asset, or workflow generation is running, the workspace should keep the session alive periodically so long model waits do not kick the user out.
- Admin login follows the same environment split: local development is 24 hours, production is 1 hour unless explicitly changed. Admin uses separate cookie `flashmuse-admin-session` and endpoint `/admin/api/auth/activity`, because the admin cookie path is `/admin`.

## Handover Maintenance Rule

- Keep current handover concise and current.
- When docs grow too long or become mixed with obsolete history, archive the current set into `historical-handover-docs-last-used-YYYY-MM-DD`.
- Then write a new current set with only important, valid content.
- Tell future AIs to consult archived docs only for difficult historical debugging.
- Archived `historical-handover-docs-last-used-*` folders are read-only. Future AIs should not edit, overwrite, delete, or move old archived files unless the user explicitly asks for historical backup cleanup.
- All normal handover updates must go into the active docs directly under `handover/`.
- Active memo tasks live in `06-memo-tasks.md`. Memo tasks are user-deferred items, not current tasks. Each memo must have a checkbox ID, a temporary reason, and what to do later. When the user says a memo is completed or no longer needed, mark its checkbox `[x]`; when the user asks to see memo tasks, show all items from that file.
