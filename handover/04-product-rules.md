# Product Rules

## Product Shape

- Product name: `闪念 / FlashMuse`.
- Goal: internal simple Jimeng-like creative assistant for chat-based image and video generation.
- Main modes: Agent/general chat, image generation, video generation, asset library, and workflow code behind a production feature gate.
- Production workflow entry stays disabled unless the user explicitly asks to open it.

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

## Reference Image Rule

- Explicit `@资产名` controls reference images and order.
- Without explicit `@`, use current uploaded/reference images or recent context according to current code.
- Avoid duplicate reference URLs before sending to model.
- The `@` menu intentionally shows only role, scene, shot, and upload-image groups to avoid large-menu lag. Manually typed `@` may still resolve other existing conversation references when the code supports them.
- Uploaded reference audio/video files can be mentioned with `@文件名` in video prompts. If the user does not manually place the mention, the client prepends missing media-file mentions to the prompt before sending.

## BytePlus Seedance Video Rule

- Normal multi-reference video mode uses only `reference_image`, up to 9 images.
- Explicit first-frame wording uses only the first image as `first_frame`.
- Explicit first-and-last-frame wording uses first image as `first_frame` and second image as `last_frame`; fewer than 2 images should block with a friendly prompt.
- Standalone tail-frame wording must not send `last_frame`; treat it as normal `reference_image` mode.
- Do not mix `first_frame`, `last_frame`, and normal `reference_image` in the same BytePlus request.
- Seedance 2.0 / Fast reference videos and audio are supported only for BytePlus video mode. Reference videos use `reference_video`; reference audio uses `reference_audio`.
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
- Workflow nodes should use the same enabled model lists as conversation image/video generation. Backend model availability switches must affect both UIs.
- Text workflow nodes correspond to Agent text generation, image nodes correspond to image generation mode, and video nodes correspond to video generation mode. UI should reuse conversation input/control/card visual language where practical.

## Auth Session Rule

- Local code now intends normal user login to be idle-based, not 30-day persistent login.
- The idle timeout is 1 hour. Real user actions such as click, keyboard, wheel, touch, or scroll call `/api/auth/activity` and extend the session.
- Routine background auth checks, workspace-instance checks, autosave, and media polling must not extend idle expiry.
- Active generation waits are treated as activity. While any conversation, asset, or workflow generation is running, the workspace should keep the session alive periodically so long model waits do not kick the user out.

## Handover Maintenance Rule

- Keep current handover concise and current.
- When docs grow too long or become mixed with obsolete history, archive the current set into `historical-handover-docs-last-used-YYYY-MM-DD`.
- Then write a new current set with only important, valid content.
- Tell future AIs to consult archived docs only for difficult historical debugging.
- Archived `historical-handover-docs-last-used-*` folders are read-only. Future AIs should not edit, overwrite, delete, or move old archived files unless the user explicitly asks for historical backup cleanup.
- All normal handover updates must go into the active docs directly under `handover/`.
- Active memo tasks live in `06-memo-tasks.md`. Memo tasks are user-deferred items, not current tasks. Each memo must have a checkbox ID, a temporary reason, and what to do later. When the user says a memo is completed or no longer needed, mark its checkbox `[x]`; when the user asks to see memo tasks, show all items from that file.
