# Architecture And Data

## Core Tables

- `User`: account, profile, credits, flags, login audit fields.
- `Session`: login sessions and active workspace instance tracking.
- `CreditLedger`: billing records for text, image, video, prompt tools, and media cost metadata.
- `UserWorkspaceState`: legacy workspace shell JSON and UI/workflow settings. Do not treat `state.assets` as the source of truth anymore.
- `WorkspaceSession`: one row per conversation, with title, soft delete state, summary/memory fields, and legacy JSON.
- `WorkspaceMessage`: one row per message, used for paged message loading and media extraction.
- `MediaAsset`: fixed media facts: URL, normalized URL, type, source, prompt, model, dimensions, poster/thumbnail, cost share, conversation/message IDs, workflow placeholders, archive status.
- `UserAssetState`: per-user mutable state for a media item: current name, category, sort order, soft delete, hidden state, BytePlus review state.

## Media Source Of Truth

- Fixed media facts belong in `MediaAsset`.
- User-visible mutable asset state belongs in `UserAssetState`.
- Conversation structure belongs in `WorkspaceSession + WorkspaceMessage`.
- Billing belongs in `CreditLedger`.
- Old workspace JSON is fallback, compatibility, and shell state only.
- Uploaded-image reverse prompts belong in `MediaAsset.reversePrompt`; display paths should prefer `reversePrompt` over upload placeholders and original `sourcePrompt`.
- New conversation uploads and generated conversation media should be persisted immediately through `/api/media-assets` and still be recoverable from `WorkspaceMessage` sync.

## Core Media Generation Chain

The image/video generation chain is a core product path. Future workflow media must reuse this same flow.

- Provider temporary URLs may be shown immediately to users for speed.
- Temporary URLs can appear in chat messages, previews, and download controls while local saving is still running.
- Temporary provider URLs must not be stored as `MediaAsset.url` or `MediaAsset.normalizedUrl`.
- Background saving is tracked in `.runtime/media-save-jobs.json`.
- When a temporary URL is saved to local `/generated/...`, the local URL becomes the durable media URL.
- Frontend polling through `/api/media-save-status` replaces temporary URLs with local URLs in chat messages, preview state, download source, asset list entries, asset-generation jobs, and workflow canvas nodes.
- Saved local media is persisted to `MediaAsset + UserAssetState` even if UI replacement is delayed by preload/static-sync readiness.
- Saved workflow media should use `workflow_images` / `workflow_videos` and include `workflowId` / `workflowNodeId` when available.
- Current workflow state is still stored in `UserWorkspaceState.state.workflowItems`, not a separate workflow table. `workflowItems` contains id, title, created/updated times, optional `usageSummary`, and `canvas` with `nodes`, `edges`, and `viewport`. `nextWorkflowNumber` is stored beside it in the workspace shell to prevent reusing names like `工作流_01` after deletion.
- `/api/workspace-state` summary shell must include `workflowItems`, `activeWorkflowId`, and `nextWorkflowNumber`. Do not strip these out of summary loads, or the frontend can autosave an empty workflow list over existing local workflow state.
- Workflow media source of truth follows the same media chain as conversation media. Local workflow images/videos should be upserted through `/api/media-assets` using categories `workflow_images` / `workflow_videos`, and should include `workflowId` and `workflowNodeId`. Frontend legacy assets returned from `mediaStateToLegacyAsset()` use `librarySource="workflow"` so they do not mix into conversation asset filters.
- `.runtime/media-url-map.md` is an operational runtime mapping from remote temporary URLs to local URLs. It may contain signed provider URLs and must not be committed or copied into docs.
- Data URLs and unsaved remote provider URLs should be skipped by asset-table sync. They are display/transient inputs, not durable asset identities.

## Current User Asset Categories

User asset library categories:

- `character_image`
- `scene_image`
- `shot_image`
- UI also shows `上传图片` in the upper asset area, but its storage category is still `conversation_uploads`.

Conversation media categories:

- `conversation_uploads`
- `conversation_images`
- `conversation_videos`

Workflow categories are now actively used by local workflow work, though production workflow entry still remains feature-gated:

- `workflow_uploads`
- `workflow_images`
- `workflow_videos`

Do not reintroduce old user-facing `shot_video` or `other` as primary asset library categories unless the user explicitly changes the product decision.

## Upload Image Rule

- `conversation_uploads` is the single unified upload-image bucket.
- Asset-library uploads, conversation-flow uploads, and future workflow uploads should all appear under the user-facing `上传图片` category.
- Moving a generated image to `上传图片` writes `UserAssetState.currentCategory="conversation_uploads"`, even if the media URL remains under `/generated/users/.../images/...` rather than `/upload_image/`.
- Upload category filtering must not rely only on URLs containing `/upload_image/`. It must also respect `currentCategory="conversation_uploads"` and frontend legacy flags like `promptSource="upload"`.
- Assistant message `imageReferences` can contain upload-image URLs used as references. These must also be synced into `MediaAsset + UserAssetState`; otherwise referenced uploads can exist on disk and in messages but be missing from the asset library.
- Fresh upload cards should use `/api/media-thumbnail?url=...` fallback when no stored `thumbnailUrl` exists, so missing thumbnail files do not render broken images.
- The upload-image placeholder text is now `上传图片`. Legacy placeholders `资产库上传` and `对话流上传` are recognized only for backward compatibility.
- All upload-image entries should start in `conversation_uploads`; do not infer role/scene/shot from upload filenames or prompt context.
- Browser image upload now uses same-origin `/api/asset-upload-temp` for temporary image uploads. Do not reintroduce cross-origin temporary image upload to `NEXT_PUBLIC_UPLOAD_BASE_URL` unless there is a verified need and browser/network behavior is retested from `ali.venusface.com` and `main.venusface.com`.
- Frontend image conversion is best-effort. If canvas JPEG conversion fails or takes more than 5 seconds, the original file is uploaded and the server re-encodes it. Server upload saving intentionally re-encodes all uploaded images through ffmpeg into standard JPG, even when the input MIME is JPEG.
- User asset category is mutable user state. Ordinary media upserts must not overwrite `UserAssetState.currentCategory` after a user has manually moved an asset. Use `/api/media-assets` `PATCH` for explicit moves; `POST` should preserve locked/user-recategorized existing state.

## Seedance Reference Media Rule

- BytePlus Seedance 2.0 and Seedance 2.0 Fast support uploaded reference videos and audio through existing `uploadedFiles` entries.
- Files are saved by `/api/upload-file` under `/generated/users/{userId}/files/` and then passed to BytePlus as public URLs.
- Reference videos are sent as `content` items with `type="video_url"` and `role="reference_video"`.
- Reference audio is sent as `content` items with `type="audio_url"` and `role="reference_audio"`.
- Audio cannot be used alone. It must be accompanied by at least one reference image or reference video.
- Frontend limits mirror BytePlus docs: video `mp4/mov`, max 3 files, each 2-15 seconds and <=50MB, total video duration <=15 seconds, aspect ratio 0.4-2.5, dimensions 300-6000px, total pixels 409600-2086876; audio `mp3/wav`, max 3 files, each 2-15 seconds and <=15MB, total audio duration <=15 seconds.
- A 0.35 second tolerance is intentionally allowed for browser media metadata rounding around exact 15 second files.
- Replay and failed-media retry must preserve `referenceVideos` and `referenceAudios`; this was fixed after `video_5_d24` was found to have lost its uploaded video/audio references during replay.

## Duplicate Media Rule

When `.runtime/media-save-jobs.json` says a remote URL was saved to local `/generated/...`:

- Keep the local `/generated/...` media as the official visible record.
- Merge costs, tokens, ledger IDs, request IDs, model, settings, prompt, and metadata from the remote record into the local record when local fields are missing.
- Archive the remote record with `archiveReason=duplicate_remote_url` and `duplicateOfMediaAssetId`.
- Hide the remote `UserAssetState` with `hiddenReason=duplicate_remote_url`.
- Do not hard delete either record.

This runtime path is implemented in `src/lib/media-assets.ts` and called from media save status, `/api/media-assets`, and workspace message upsert.

## Asset Sorting Rule

- Normal sorting is latest first by `MediaAsset.firstSeenAt desc`, then `createdAt desc`, then `id desc`.
- User move operations write `UserAssetState.sortOrder` as a timestamp-level integer.
- Only timestamp-level `sortOrder` values should override latest-first sorting. Small legacy sort orders must not reorder the whole category.
- The virtual generation card in asset categories stays first; latest real media appears after it.

## Migration Scripts

Current important scripts:

- `scripts/rebuild-media-asset-registry.mjs`
- `scripts/migrate-user-media-assets.mjs`
- `scripts/migrate-selected-media-users.mjs`
- `scripts/audit-visible-duplicate-media.mjs`
- `scripts/audit-user-media-cost-gaps.mjs`
- `scripts/README-media-assets.md`

Historical online migration result:

- Trial account `ID_636611` was migrated, de-duplicated, enriched, and audited.
- 20 additional online media accounts were migrated and audited.
- Final reported result: `visibleDuplicateGroups=0` and `unmatchedLedgers=0` for migrated accounts.
- Logs are on Malaysia server under `/var/www/flashmuse/.runtime/media-migration-logs/`.

Do not run broad destructive migrations. If more migration work is needed, dry-run first and keep logs.
