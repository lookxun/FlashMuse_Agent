# Next Actions

## Do First

1. Run `git status --short` and inspect diffs before editing.
2. Remember that the newest 2026-06-23 workflow/media-table work is deployed but not committed or pushed after this deployment. Inspect status/diff carefully before further changes.
3. Do not revert unrelated local/user changes.
4. Run `npx tsc --noEmit` before committing or deploying code changes.
5. For deployment, use the current risk-based rule: low-impact deploys may be done directly; anything that may affect active frontend users or running tasks must be explained to the user first and approved before deployment.
6. For risky workspace/asset deploys, first run production snapshot `node .runtime/deploy-checks/prod-deploy-snapshot.mjs snapshot BEFORE_LABEL`, deploy, run another snapshot, then compare. If compare fails, stop and fix or roll back.

## Highest Priority

- The 2026-06-24 workflow/input-scroll work has been deployed with production workflow entry still disabled. Before future deploys or GitHub syncs, inspect diffs and rerun `npx tsc --noEmit`. Important files from this deploy include `src/components/workflow-canvas.tsx`, `src/components/chat-workbench.tsx`, `src/lib/workspace-workflows.ts`, `src/app/api/media-assets/route.ts`, `src/app/api/workspace-state/route.ts`, `src/app/layout.tsx`, `prisma/schema.prisma`, and migration `prisma/migrations/20260624090000_workflow_media_names/`.
- Browser-retest the deployed conversation input box: with long text, scroll upward inside the input, then type, paste, press `Shift+Enter`, delete `@` spans, and insert `@` assets. The view and caret should stay near the user's current scroll area; only bottom-position typing should auto-follow the bottom.
- Retest local workflow generation end-to-end before any deploy: create multiple image nodes in the same workflow, generate from each, verify each node keeps its own result, names increment independently (`image_1_w2`, `image_2_w2`, etc.), failures do not consume numbers, refresh preserves node names/dimensions, and right-side preview thumbnails show only current workflow canvas media.
- Retest workflow remote-to-local media replacement: temporary provider URL should display immediately; when saved local `/generated/...` appears, node `images/videoUrl`, node `mediaSystemNames`, node dimensions/poster, preview asset, and `MediaAsset + UserAssetState` should all remain consistent and should not overwrite system names with `图片生成` / `视频生成`.
- Local data for `12424740@qq.com / ID_779117` was manually repaired during workflow debugging. If results look inconsistent, query `WorkspaceWorkflow.workflowCode in ('w1','w2')`, `canvasJson.nodes[].data.mediaSystemNames`, and `UserAssetState + MediaAsset` workflow rows before making more code changes.
- Hydration warning can still appear when SSR renders chat mode but stored client UI starts in workflow mode. It is recoverable, but future cleanup should make initial client render match SSR or delay active-panel restoration until after hydration.

- Admin navigation split, server-info, workflow foundation code, workflow table persistence, new-table-only asset work, admin idle-timeout, and Agent prompt-detail persistence were deployed on 2026-06-23. Production workflow entry remains disabled because `NEXT_PUBLIC_WORKFLOW_MODE_ENABLED` is unset/false.
- Test `服务器信息` with an authenticated production admin browser session. Local Windows Node can fail to SSH to Malaysia even when manual PowerShell SSH works; production is the intended environment because the Malaysia app can read itself and jump to Ali with `/root/.ssh/flashmuse_to_ali_ed25519`.
- Retest deployed auth idle behavior in production: user action extends session; no action expires after 1 hour even if browser is closed; routine auth/workspace polling does not extend it; active generation keepalive prevents logout during long waits.
- Stabilize and verify the new media table flow end-to-end.
- Confirm asset library category loading, pagination, moving, rename, delete, restore, and `@` reference behavior.
- Specifically retest `上传图片`: asset-library upload, conversation upload, moving generated images into upload category, reference images from `imageReferences`, thumbnail fallback, count/grid consistency, same-origin temporary upload, and fallback upload of unusual JPEG files.
- Retest admin expansion UX on the real heavy account: user management, credits management, generation records, category switching cache, and on-demand dialogs.
- Confirm runtime remote/local duplicate canonicalization after new image and video generations.
- Retest the core media chain for both image and video: temporary provider URL displays immediately, preview opens, download button works on the temporary URL, local `/generated/...` save completes, chat/preview/download/assets replace to the local URL, and `MediaAsset.url` stores only the local URL.
- Retest the same remote-to-local replacement after refresh/reopen. If a browser saved a temporary URL before replacement, `/api/media-save-status` should still find the saved job and replace/persist the local URL later.
- When workflow mode is eventually enabled, retest workflow node image/video URLs specifically. Workflow node `images` and `videoUrl` are now included in the same media-save-status polling/replacement path and should persist as `workflow_images` / `workflow_videos`.
- Retest workflow basics locally or in a controlled production session only after workflow entry is explicitly enabled: default `新工作流`, new-workflow reuse, first action renaming to `工作流_01`, non-reuse of deleted numbers, delete-last-workflow fallback, 10-item list limit and 5-item load-more, rename/delete/pin behavior, and persistence after refresh.
- Retest workflow node UI and generation: selected cards use only a 1px blue card border, left/right `+` connection behavior, text/image/video node input box matches conversation input at 680px width, menus open above connection buttons, model menus show icons, and image/video model lists honor `/api/model-availability` backend switches.
- Retest workflow generation chain: text node `/api/chat`, image node `/api/image`, video node `/api/video` create/poll, usage counter update, waiting/failure/success cards, reference text/images from upstream nodes, workflow asset persistence, and remote-to-local replacement.
- Retest deployed login idle behavior: user action extends session; no action expires after 1 hour even if browser is closed; routine auth/workspace polling does not extend it; active generation keepalive prevents logout during long waits.
- Retest BytePlus Seedance 2.0 / Fast video mode with uploaded reference video and audio: fresh send, replay/regenerate, failed-card retry, audio-only blocking, duration tolerance around 15s, input-card `@` insertion, sent prompt inline icons, and preview playback.
- Retest BytePlus automatic human-reference review UI. Each new image review should show the blue system notice once per request, even if the same conversation had previous review notices.
- Retest `video_5_d24` scenario by regenerating a new video with a reference image, `abbbbbb.mp4`-style reference video, and `demo_chinese.mp3`-style audio. Old `video_5_d24` was already generated without video/audio references and cannot be fixed retroactively.
- Latest deployed changes now include the 2026-06-24 workflow/input-scroll deploy. If future deployed local changes accumulate and the user asks for GitHub sync, inspect status/diff/log, run `npx tsc --noEmit`, then commit and push.
- Before any future commit or GitHub sync, review the deployed-but-uncommitted Prisma migrations `20260623043000_workspace_workflows` and `20260623044000_backfill_workspace_workflows`, the new `src/lib/workspace-workflows.ts`, `scripts/prod-deploy-snapshot.mjs`, admin idle files, Agent prompt-detail changes, and all new-table-only asset changes.
- Retest local workflow persistence after browser refresh with `12424740@qq.com` and `lookxun@163.com`. Expected local data: `12424740@qq.com / ID_779117` has `工作流_01` and `工作流_02`; `lookxun@163.com / ID_113219` has `工作流_06` and `工作流_04`.
- Retest production asset library with authenticated real accounts after the new-table-only deploy. Latest snapshot says visible asset counts stayed unchanged and `fallbackUsers=0`, but browser-level category actions still need human validation.
- Retest upload-file paths: uploaded video should write `sourcePrompt="上传视频"`, uploaded audio should write `sourcePrompt="上传音频"`, and uploaded document should write `sourcePrompt="上传文档"` into `MediaAsset + UserAssetState`. These categories are internal for now and not shown in the asset sidebar yet.
- Retest Agent-generated image/video prompt display in admin. Main prompts should be black; Agent hard constraints from `MediaAsset.sourceDetail.agentConstraints` should be gray; multi-image/multi-video prompt-to-asset mapping should not be mixed.

## Specific Checks To Run When Needed

- `npx tsc --noEmit`.
- `npx prisma generate` after applying local migrations or after stopping `next dev` if Prisma engine files are locked on Windows.
- `node scripts/audit-visible-duplicate-media.mjs --user=USER_ID`.
- `node scripts/audit-user-media-cost-gaps.mjs --user=USER_ID`.
- Open production `/workspace` and test asset library actions with a real user account.
- Check PM2 logs and `.runtime/video-diagnostics-log.jsonl` for BytePlus video issues.
- When diagnosing Seedance reference media, check both `WorkspaceMessage.messageJson.uploadedFiles` and `.runtime/video-diagnostics-log.jsonl`; before the replay fix, diagnostics showed only `reference_image` even though the message had uploaded video/audio files.
- Check `.runtime/media-save-jobs.json` when remote/local media duplication appears.
- Check `.runtime/media-url-map.md` when diagnosing a generated item that displayed with a temporary URL but should have replaced to `/generated/...`. Do not commit or paste signed remote URLs from this runtime file into docs.
- For deployment safety, run `node .runtime/deploy-checks/prod-deploy-snapshot.mjs snapshot LABEL` and compare pre/post snapshots. Current baseline files are `20260623-before-risk-deploy.json`, `20260623-after-risk-deploy.json`, and `20260623-after-hotfix.json`.
- Check Nginx access/error logs for upload failures. `413` means body size/config issue; current intended limit is `20m`.
- For upload failures, also check PM2 logs for `[client-error]` entries with `source="client-diagnostic"`. User-facing upload cards intentionally show only generic `上传失败`.

## Known Follow-Ups

- Review why public `static.venusface.com` and `ali.venusface.com` checks returned 403/000 even though Ali local SNI works.
- If committing, include deployed uncommitted files such as `src/lib/media-assets.ts`, `src/app/api/media-assets/route.ts`, workflow migrations, `src/lib/workspace-workflows.ts`, admin idle files, and `scripts/prod-deploy-snapshot.mjs`.
- Keep production workflow mode disabled until user explicitly approves opening it.
- If input `@` editing bugs resurface, consider whether the contenteditable mention implementation needs a focused refactor.
- Upload-rule table is now deployed as standalone backend tab `上传规则` via `src/app/admin/admin-upload-rules-panel.tsx`. Keep it synchronized with `src/lib/upload-rules.ts` when upload limits change.
- Memo tasks are in `handover/06-memo-tasks.md`; update that file, not historical docs, when the user says something is a deferred memo task.

## Avoid

- Do not run broad migrations without dry-run and logs.
- Do not use old handover docs as current truth without checking against code/server state.
- Do not hard-delete generated media or database records under current product rules.
- Do not expose `.env`, API keys, server passwords, SMTP credentials, or private keys in docs or commits.
