# Next Actions

## Do First

1. Run `git status --short` and inspect diffs before editing.
2. Remember that local code has deployed but uncommitted changes.
3. Do not revert unrelated local/user changes.
4. Run `npx tsc --noEmit` before committing or deploying code changes.
5. For deployment, use the current risk-based rule: low-impact deploys may be done directly; anything that may affect active frontend users or running tasks must be explained to the user first and approved before deployment.

## Highest Priority

- Admin navigation split, server-info, workflow foundation code, and auth idle-timeout changes were deployed on 2026-06-23, but production workflow entry remains disabled because `NEXT_PUBLIC_WORKFLOW_MODE_ENABLED` is unset/false.
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
- Latest deployed uncommitted changes were prepared for GitHub sync on 2026-06-23 after user request. If future deployed local changes accumulate again, inspect status/diff/log, run `npx tsc --noEmit`, then commit and push.

## Specific Checks To Run When Needed

- `npx tsc --noEmit`.
- `node scripts/audit-visible-duplicate-media.mjs --user=USER_ID`.
- `node scripts/audit-user-media-cost-gaps.mjs --user=USER_ID`.
- Open production `/workspace` and test asset library actions with a real user account.
- Check PM2 logs and `.runtime/video-diagnostics-log.jsonl` for BytePlus video issues.
- When diagnosing Seedance reference media, check both `WorkspaceMessage.messageJson.uploadedFiles` and `.runtime/video-diagnostics-log.jsonl`; before the replay fix, diagnostics showed only `reference_image` even though the message had uploaded video/audio files.
- Check `.runtime/media-save-jobs.json` when remote/local media duplication appears.
- Check `.runtime/media-url-map.md` when diagnosing a generated item that displayed with a temporary URL but should have replaced to `/generated/...`. Do not commit or paste signed remote URLs from this runtime file into docs.
- Check Nginx access/error logs for upload failures. `413` means body size/config issue; current intended limit is `20m`.
- For upload failures, also check PM2 logs for `[client-error]` entries with `source="client-diagnostic"`. User-facing upload cards intentionally show only generic `上传失败`.

## Known Follow-Ups

- Review why public `static.venusface.com` and `ali.venusface.com` checks returned 403/000 even though Ali local SNI works.
- If committing, include newly added `src/lib/media-assets.ts` and `src/app/api/media-assets/route.ts`.
- Keep production workflow mode disabled until user explicitly approves opening it.
- If input `@` editing bugs resurface, consider whether the contenteditable mention implementation needs a focused refactor.
- Upload-rule table is now deployed as standalone backend tab `上传规则` via `src/app/admin/admin-upload-rules-panel.tsx`. Keep it synchronized with `src/lib/upload-rules.ts` when upload limits change.
- Memo tasks are in `handover/06-memo-tasks.md`; update that file, not historical docs, when the user says something is a deferred memo task.

## Avoid

- Do not run broad migrations without dry-run and logs.
- Do not use old handover docs as current truth without checking against code/server state.
- Do not hard-delete generated media or database records under current product rules.
- Do not expose `.env`, API keys, server passwords, SMTP credentials, or private keys in docs or commits.
