# Memo Tasks

Last synced: 2026-06-26

Definition: memo tasks are things the user says not to do now but may want later. Each item must include why it is not being done now and what to do later. When the user asks to see memo tasks, show all items in this file.

Historical docs were checked on 2026-06-21. Old items that are already done or clearly obsolete were not migrated here.

## Active Memo Tasks

### [ ] M015 阿里端上传压缩转发小服务（2026-07-09 与用户讨论，押后）

临时不做原因：用户认可思路但决定"以后再说"，先不做。目标是让**上传更快**——上传慢在"阿里→马来"跨境这段，要减小过境体积就得在"过境前"压缩。浏览器端压图片可行但压不了视频；服务端（马来）压缩发生在过境后，对上传提速无用。

关键结论（已查证）：
- 阿里那台现在**只有 nginx（纯反代，只转发字节，不能调用 sharp/ffmpeg 压缩 body）**。要在阿里压缩，必须跑一个**应用进程**接收→压缩→转发马来。不是"装不装库"的问题，是"谁来调用"。
- 阿里机器：**2 核 Xeon 6982P-C + 3.4G 内存，长期几乎全闲（load 0.2），系统已装 ffmpeg（/usr/bin/ffmpeg）**。CPU 层面扛得住：图片 sharp 压缩零压力；视频 ffmpeg 转码 2 核偏紧但**限制同时最多 1 个转码 + 用 veryfast preset** 即可，以内部工具的上传频率碰不到瓶颈。
- 真正的成本不是 CPU，而是要**部署并长期维护一个阿里小 Node 服务**（鉴权 token、大文件流式、错误重试、和马来代码别版本脱节）。它比 Option B（阿里跑整套 App）轻很多，只干"接收→压缩→转发"一件事。

三方案对比：浏览器端压缩（图片✅/视频❌，工作量小）；阿里小服务压缩转发（图片✅/视频✅，工作量中）；Option B 阿里跑整套 App（工作量大）。

以后要做时：先定选哪个方案。若做阿里小服务，先设计结构（接口、鉴权 token 怎么透传、和马来 upload-file 怎么衔接、落盘/回传怎么处理、部署方式），确认后再动手。注意视频转码要限并发+快 preset。

### [ ] M001 Server-To-Provider Public Reference URLs

Temporary reason: do not change now because the user may change domains later, and the public URL base must be stable before changing provider request behavior.

What to do later: after domain changes are settled, change server-to-model-provider reference media handling so local `/generated/...` media is sent to BytePlus/OpenRouter as public HTTPS URLs instead of being converted back to base64 data URLs. Verify the chosen public domain is reachable by provider servers, not 403, not login-gated, and not expired. Relevant current code: `src/lib/openrouter.ts`, `src/lib/openrouter-video.ts`, and `src/lib/seedance.ts` functions named `toDataUrlIfLocalPublicAsset()`.

### [x] M002 Static Domain Public Access

Temporary reason: completed on 2026-06-26 after domain review passed and public HTTP/HTTPS access was verified.

What to do later: no action unless public access regresses. Current `ali.venusface.com` and `static.venusface.com` HTTP redirect to HTTPS, HTTPS returns 200, and static/generated media paths are verified.

### [ ] M003 Production Workflow Mode

Temporary reason: workflow code exists but production workflow mode must stay disabled until the user explicitly approves opening it.

What to do later: when approved, enable production workflow entry, retest workflow uploads/generation/media persistence, and make workflow media categories (`workflow_uploads`, `workflow_images`, `workflow_videos`) visible where needed.

### [x] M004 Commit Deployed Local Changes

Temporary reason: completed on 2026-06-23 after the user asked to do a GitHub sync. Future local workflow/repo-rename changes were also committed and pushed on 2026-06-26.

What to do later: no action unless future deployed local changes accumulate again. Current GitHub repository is `https://github.com/lookxun/FlashMuse_Agent`; latest pushed sync commit is `1c9211d Sync local workflow updates and repo rename`.

### [ ] M005 Input Mention Refactor

Temporary reason: current `@` mention behavior is acceptable after recent fixes; refactor risk is higher than benefit unless bugs resurface.

What to do later: if input `@` editing bugs resurface, do a focused contenteditable mention refactor for atomic mention deletion, cursor behavior, typed mention resolution, and blue inline rendering.

### [x] M006 Ali Static Certificate Renewal Automation

Temporary reason: completed on 2026-06-26. The `flashmuse-ali-static` certificate was reissued through HTTP-01 webroot after domain review passed.

What to do later: no DNS API key is needed under the current setup. Certbot renewal config uses `authenticator = webroot` with `/var/www/letsencrypt`, `certbot.timer` exists, `certbot renew --dry-run --cert-name flashmuse-ali-static --no-random-sleep-on-renew` passed, and `/etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh` reloads Nginx after renewal.

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

### [ ] M014 GPT Image Prompt Optimization Phase 2

Temporary reason: first version is now local-only and should be tested online/local in workflow mode before expanding. The first version records successful GPT-5.4 Image 2 safety rewrite cases but does not yet analyze them automatically.

What to do later: after enough successful cases accumulate, add automatic success-case analysis, store a rolling analysis report, feed that report into future rewrite prompts, add success/cost/latency statistics, and consider copying the feature from workflow image nodes to conversation-flow image generation. See `handover/08-gpt-image-prompt-optimization.md`.
