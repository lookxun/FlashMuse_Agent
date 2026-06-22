# Memo Tasks

Last synced: 2026-06-21

Definition: memo tasks are things the user says not to do now but may want later. Each item must include why it is not being done now and what to do later. When the user asks to see memo tasks, show all items in this file.

Historical docs were checked on 2026-06-21. Old items that are already done or clearly obsolete were not migrated here.

## Active Memo Tasks

### [ ] M001 Server-To-Provider Public Reference URLs

Temporary reason: do not change now because the user may change domains later, and the public URL base must be stable before changing provider request behavior.

What to do later: after domain changes are settled, change server-to-model-provider reference media handling so local `/generated/...` media is sent to BytePlus/OpenRouter as public HTTPS URLs instead of being converted back to base64 data URLs. Verify the chosen public domain is reachable by provider servers, not 403, not login-gated, and not expired. Relevant current code: `src/lib/openrouter.ts`, `src/lib/openrouter-video.ts`, and `src/lib/seedance.ts` functions named `toDataUrlIfLocalPublicAsset()`.

### [ ] M002 Static Domain Public Access

Temporary reason: not blocking the main app because `main.venusface.com` and `api.venusface.com` are working; Ali local SNI works, but public checks for `static.venusface.com` and `ali.venusface.com` returned 403/000.

What to do later: review DNS, proxy, firewall, certificate, and Nginx path for `static.venusface.com` and `ali.venusface.com`. Confirm whether generated media and `_next/static` should be publicly served from those domains.

### [ ] M003 Production Workflow Mode

Temporary reason: workflow code exists but production workflow mode must stay disabled until the user explicitly approves opening it.

What to do later: when approved, enable production workflow entry, retest workflow uploads/generation/media persistence, and make workflow media categories (`workflow_uploads`, `workflow_images`, `workflow_videos`) visible where needed.

### [x] M004 Commit Deployed Local Changes

Temporary reason: completed on 2026-06-23 after the user asked to do a GitHub sync.

What to do later: no action unless future deployed local changes accumulate again.

### [ ] M005 Input Mention Refactor

Temporary reason: current `@` mention behavior is acceptable after recent fixes; refactor risk is higher than benefit unless bugs resurface.

What to do later: if input `@` editing bugs resurface, do a focused contenteditable mention refactor for atomic mention deletion, cursor behavior, typed mention resolution, and blue inline rendering.

### [ ] M006 Ali Static Certificate Renewal Automation

Temporary reason: current `flashmuse-ali-static` certificate was created with manual DNS-01 and is not an immediate blocker.

What to do later: before expiry, either manually renew with TXT records or automate renewal using Aliyun DNS API. Use a least-privilege RAM AccessKey for `venusface.com` DNS only, store credentials outside Git with `600` permissions, install a certbot-compatible Aliyun DNS plugin, and run `certbot renew --dry-run`.

### [ ] M007 Formal Frontend Monitoring

Temporary reason: current `/api/client-error` and browser global error capture are useful temporary diagnostics, and replacing them is not urgent.

What to do later: if the app enters more formal production operations, replace or supplement the temporary client-error endpoint with a proper frontend monitoring system, then remove redundant temporary logging if appropriate.

### [ ] M008 Media Save Queue For Multi-Instance Deployment

Temporary reason: current `.runtime/media-save-jobs.json` queue is sufficient for the current single production instance.

What to do later: before multi-instance deployment, move media save queue/status from local runtime JSON files into a database table or queue service so polling and duplicate canonicalization work across instances.

### [ ] M009 BytePlus Asset Review Asset-URL Flow

Temporary reason: current automatic review flow has working first-version behavior; a full `asset://assetId` flow depends on stable public HTTPS media URLs and BytePlus asset-library behavior.

What to do later: save upload/asset/generated images as provider-accessible HTTPS URLs, submit BytePlus asset creation/review, persist approved `assetId`, and send approved human reference images to video generation as `asset://assetId` when appropriate.

### [ ] M010 Migration And Audit Script Cleanup

Temporary reason: temporary migration/debug scripts have been useful during online fixes; cleaning them up is lower priority than feature stabilization.

What to do later: review useful scripts from `tmp/` and historical migration work, move stable ones into `scripts/`, document usage and dry-run behavior, and avoid deleting anything still needed for production audits.

### [ ] M011 Duplicate `.env.local` Cleanup

Temporary reason: production currently works, and editing environment files carries risk of exposing or breaking secrets.

What to do later: clean the duplicate `DATABASE_URL` lines in production `.env.local` carefully on the server, without exposing credentials in chat, commits, or handover docs. Verify Prisma commands still use the intended URL afterward.

### [ ] M012 Voice Clone / TTS For Consistent Character Voice

Temporary reason: current video reference audio is not a reliable voice-cloning solution, and the current MVP focuses on image/video generation.

What to do later: if the user wants consistent character voice, evaluate dedicated TTS or voice-cloning providers such as ElevenLabs, MiniMax Speech, Volcano/BytePlus speech, or Fish Audio instead of relying on video model reference audio.

### [ ] M013 Song-To-MV Workflow

Temporary reason: not part of the current MVP priority, and workflow mode remains disabled in production.

What to do later: design a workflow like song generation or upload -> Agent splits MV shots -> video models generate shots -> ffmpeg or equivalent combines video with audio.
