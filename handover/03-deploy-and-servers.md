# Deploy And Servers

## Malaysia Main Server

- Role: main Next.js app, API, PostgreSQL, generated media source.
- IP: `101.47.19.109`.
- Project path: `/var/www/flashmuse`.
- PM2 process: `flashmuse`.
- Standard deploy script: `/usr/local/bin/deploy-flashmuse-production.sh`.
- Login key path on local machine: `E:\project\【2】server\马来西亚服务器\ByteplusVPS.pem`.
- Safe login command: `ssh -i "E:\project\【2】server\马来西亚服务器\ByteplusVPS.pem" root@101.47.19.109`.

Current notes:

- `/var/www/flashmuse` did not show a usable Git worktree during rebuild, so Git status on the server is not reliable.
- Source file hashes for key local files matched the Malaysia server deployment during rebuild.
- PM2 was online during rebuild.
- Recent deployment backup names included `20260620202220-asset-dedupe-ui-fix`.
- Latest deployment backups from 2026-06-21 Seedance reference media work include `20260621053806-seedance-av-upload`, `20260621055453-media-mention-preview-fix`, `20260621060108-media-duration-epsilon`, `20260621061058-media-input-mention-click`, `20260621061807-media-prompt-inline-render`, `20260621062457-assistant-uploaded-files-fix`, `20260621063426-byteplus-review-notice-once`, `20260621064500-review-notice-per-request`, `20260621065215-replay-media-references`, `20260621065646-admin-upload-rules-text`, and `20260621065952-admin-upload-rules-columns`.
- Later 2026-06-21 deploy backups include `20260621-admin-credit-last-change-sort`, `20260621-admin-upload-rules-image-reference`, `20260621-asset-category-preserve`, `20260621-asset-sidebar-group-counts`, `20260621-asset-page-size-loading`, `20260621-asset-pagination-loop-fix`, `20260621-upload-image-fallback`, `20260621-upload-image-conversion-timeout`, `20260621-upload-diagnostics`, and `20260621-same-origin-image-upload`.
- BytePlus video diagnostics are under `/var/www/flashmuse/.runtime/video-diagnostics-log.jsonl`. Use this to verify whether requests include only `reference_image` or also `reference_video` / `reference_audio`.
- Latest 2026-06-23 deployment uploaded the full local source snapshot, backed up production source to `.deploy-backups/20260623-full-local-deploy/source-before-deploy.tgz`, then ran `/usr/local/bin/deploy-flashmuse-production.sh`. Build passed with only existing Turbopack/NFT warnings; PM2 stayed online; Ali `_next/static` synced and cache cleared. `NEXT_PUBLIC_WORKFLOW_MODE_ENABLED` was confirmed disabled/unset.
- Latest protected deployment after that used pre/post asset snapshots. Before deploy snapshot: `.runtime/deploy-checks/20260623-before-risk-deploy.json`; after deploy snapshot: `.runtime/deploy-checks/20260623-after-risk-deploy.json`; hotfix snapshot: `.runtime/deploy-checks/20260623-after-hotfix.json`. Snapshot comparison returned `ok: true` with unchanged totals, per-user assets, per-category assets, and `assetListHash=ff9ef4f9f85ff233`.
- Latest protected deployment backups: `.deploy-backups/20260623-risk-flow/source-before-deploy.tgz` and `.deploy-backups/20260623-workspace-crash-hotfix/source-before-hotfix.tgz`.
- Latest 2026-06-24 deploy uploaded local source archive `/tmp/flashmuse-20260624-workflow-input-deploy.tgz`, backed up production source to `.deploy-backups/20260624-workflow-input-deploy/source-before-deploy.tgz`, applied Prisma migration `20260624090000_workflow_media_names`, ran `npx prisma generate`, then `/usr/local/bin/deploy-flashmuse-production.sh`. Build passed with only existing Turbopack/NFT warnings, PM2 stayed online, and Ali `_next/static` synced. `NEXT_PUBLIC_WORKFLOW_MODE_ENABLED` was confirmed disabled/unset before deploy.
- Latest 2026-06-24 deploy guard files: before snapshot `.runtime/deploy-checks/20260624-before-workflow-input-deploy.json`, after snapshot `.runtime/deploy-checks/20260624-after-workflow-input-deploy.json`. Compare returned `ok: true`; `stableMissingInNewTable=0`, `fallbackUsers=0`, and `assetListHash=81ece40e2d3c6134` stayed unchanged.
- Latest 2026-06-26 app deploy was a narrow error-message-only deploy. Only `src/lib/error-message.ts` was copied to production, with backup `/var/www/flashmuse/.deploy-backups/20260626-error-message-audio-sensitive/error-message.ts.before`, then `/usr/local/bin/deploy-flashmuse-production.sh` ran. Build passed with existing Turbopack/NFT warnings; PM2 stayed online; Ali `_next/static` synced; `/workspace`, `/admin`, and `/api/model-availability` returned 200. Local tldraw/workflow work was intentionally not deployed.
- Latest 2026-06-28 deploys were narrow production diagnostics/upload UI deploys. They intentionally did not deploy local workflow/tldraw dirty work. Backups: `.deploy-backups/20260628162851-generation-diagnostics`, `.deploy-backups/20260628164248-upload-diagnostics`, `.deploy-backups/20260628170012-upload-timeout-label`, and `.deploy-backups/20260628171000-upload-timeout-90s`.
- New production diagnostic file `.runtime/generation-diagnostics-log.jsonl` records text/Agent/intent, image, video, and media-save main generation chain diagnostics. It is created on first relevant request.
- New production diagnostic file `.runtime/upload-diagnostics-log.jsonl` records `/api/asset-upload-temp` and image upload/re-encode/commit diagnostics. It is created on first relevant upload request.
- 2026-06-28 deployment verification passed after each narrow deploy: local and/or production `npx tsc --noEmit` passed, production build passed with only existing Turbopack/NFT broad-file warnings, PM2 stayed online, Ali `_next/static` synced, and `/workspace`, `/admin` when checked, `/api/model-availability`, and `/api/asset-upload-temp` OPTIONS when checked returned 200/204.
- Latest 2026-06-30 full deploy uploaded the current local source snapshot including conversation Seedance `参考模式`, admin upload-rule overrides, backend upload-rule enforcement, and workflow code. Production workflow entry remained disabled because `NEXT_PUBLIC_WORKFLOW_MODE_ENABLED` was still unset/false. Backup: `.deploy-backups/20260630-full-seedance-upload-rules/source-before-deploy.tgz`. Source archive: `/tmp/flashmuse-20260630-full-seedance-upload-rules.tgz`. Server needed `npm install` first because `tldraw` was missing from old production `node_modules`; after that production `npx tsc --noEmit` and `npm run build` passed with existing Turbopack/NFT warnings, PM2 restarted online, and Ali `_next/static` synced. Guard snapshots: `.runtime/deploy-checks/20260630-before-full-seedance-upload-rules.json` and `.runtime/deploy-checks/20260630-after-full-seedance-upload-rules.json`; compare changed because live users generated 2 new messages/assets during deploy, but `stableMissingInNewTable=0` and `fallbackUsers=0` stayed safe. `/workspace`, `/admin`, `/api/model-availability`, and `/api/asset-upload-temp` OPTIONS returned 200/204 after deploy.
- Later 2026-06-30 narrow deploys improved upload reliability and video poll recovery. Backups: `.deploy-backups/20260630-upload-retry-api-base` and `.deploy-backups/20260630-video-poll-recovery-upload-base`. Deployed files were `src/app/api/asset-upload-temp/route.ts`, `src/app/api/upload-image/route.ts`, `src/components/chat-workbench.tsx`, and `src/components/workflow-tldraw-canvas-inner.tsx`. Changes: auto `forceReencode=1` retry for JPEGs requiring transcode; production uploads default to `https://api.venusface.com` with token auth and CORS for the VenusFace domains; conversation/workflow video polling keeps waiting on transient poll/network/502 errors once a `taskId` exists. Production `npx tsc --noEmit` and build passed with existing Turbopack/NFT warnings, PM2 restarted online, Ali `_next/static` synced, `/workspace` and `/api/model-availability` returned 200, and upload CORS preflight returned 204.
- Latest 2026-07-02 narrow deploy fixed BytePlus reference auto-review for `B_254`. Only `src/app/api/video/route.ts` was uploaded. Backup: `.deploy-backups/20260702-b254-video-audio-review/route.ts.before`. The fix expands auto review from images only to images, videos, and audios, creating BytePlus assets with `AssetType: Image | Video | Audio` and retrying with reviewed `asset://...` references. Production `npx tsc --noEmit` passed, build passed with existing Turbopack/NFT warnings, PM2 `flashmuse` restarted online, PM2 state saved, Ali `_next/static` synced, `/workspace` and `/api/model-availability` returned 200. No local workflow/GPT/upload-node changes were deployed in this hotfix.
- Later 2026-07-02 narrow deploy fixed stale conversation media red-error text after successful retry. Only production `src/components/chat-workbench.tsx` was patched manually, not broad local dirty source. Backup: `.deploy-backups/20260702-clear-media-error-on-retry-success/chat-workbench.tsx.before`. The fix clears matching `mediaErrorReasons` / `error` after image/video failed-slot retry succeeds and hides media red text when no visible failed card remains. Production `npx tsc --noEmit` passed, `/usr/local/bin/deploy-flashmuse-production.sh` passed with existing Turbopack/NFT broad-file warnings, PM2 restarted/saved, Ali `_next/static` synced, `/workspace` and `/api/model-availability` returned 200.
- Manual production recovery on 2026-06-30: BytePlus task `cgt-20260630212727-nnttf` for user `ID_636611`, conversation `bd20879c-44b4-4760-91a8-83c4b0441ce3`, message `fdb7d980-c06d-4ac9-af30-6473003d222e`, request `2538a032-2874-4f6c-b51c-299e056dbdbc` was interrupted by the deploy restart but later queried as `succeeded`. Recovered video `/generated/users/ID_636611/videos/1782829256422-78469703-e341-4bd2-b59d-c7bcaf44ce0b.mp4` and poster `/generated/users/ID_636611/video-posters/1782829256422-78469703-e341-4bd2-b59d-c7bcaf44ce0b.jpg`, synced to Ali, updated message/session JSON, and upserted `conversation_videos` asset `video_142059`. Backup before recovery is under `.runtime/manual-fixes/*-recover-video-cgt-20260630212727-nnttf-before.json`.
- Latest 2026-07-03 full deploy shipped all previously-undeployed local source (workflow connections/uploads/GPT-optimization code, backend BytePlus video/audio auto-review, admin GPT tab) with the production workflow entry still disabled. Steps used (done over SSH from the local Windows machine): create source tarball excluding `public` (unchanged home-assets already on server), `node_modules`, `.next`, `.git`, `.runtime`, `.deploy-backups`, `.env*`; scp to `/tmp/flashmuse-deploy.tgz` (md5 verified); back up current source to `.deploy-backups/20260703-workflow-code-full/source-before-deploy.tgz`; before snapshot `before-20260703-workflow-code-full.json`; extract source; `npx prisma migrate deploy` (applied `20260701043000_gpt_image_prompt_optimization_cases`) + `npx prisma generate`; `/usr/local/bin/deploy-flashmuse-production.sh` (build + PM2 restart/save + Ali sync). IMPORTANT DATABASE_URL note: production `.env.local` has TWO `DATABASE_URL` lines and the SECOND is malformed (leading space); when setting it for prisma, use the FIRST line: `export DATABASE_URL="$(grep -E '^DATABASE_URL=' .env.local | head -1 | cut -d= -f2- | tr -d '\r' | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^\"//' -e 's/\"$//')"`. Also: when piping shell scripts to the server from Windows, strip CRLF first (`sed -i 's/\r$//' file`) or bash fails on `$'\r'`. Post-deploy: `/workspace` 200, `/admin` 200, `/api/model-availability` 200, `/api/asset-upload-temp` OPTIONS 204, new `/api/workflow-prompt-optimization/rewrite` POST 400 (missing-prompt validation) and `/cases` POST 401 (unauth). Snapshot compare showed only one live user soft-removing 13 uploads during the window (total unchanged), `stableMissing`/`fallbackUsers` 0 before+after. `NEXT_PUBLIC_WORKFLOW_MODE_ENABLED` confirmed absent before and after. Committed+pushed as `3455532`.
- `scripts/prod-deploy-snapshot.mjs` is the reusable deploy guard. Production copy: `.runtime/deploy-checks/prod-deploy-snapshot.mjs`. Use it before risky deploys: `node .runtime/deploy-checks/prod-deploy-snapshot.mjs snapshot LABEL`, then compare with `node .runtime/deploy-checks/prod-deploy-snapshot.mjs compare BEFORE.json AFTER.json`.
- For database changes on production, set `DATABASE_URL` from the running PM2 process if `.env.local` cannot be sourced directly. Working pattern used: `export DATABASE_URL="$(pm2 env 0 | grep ^DATABASE_URL | cut -c15-)"`, then run `npx prisma migrate deploy` and `npx prisma generate` before the standard deploy script.
- On 2026-06-21, upload failures around 1MB were traced to `/etc/nginx/conf.d/flashmuse.conf`: missing semicolons after `server_name main.venusface.com api.venusface.com` caused `client_max_body_size` to be parsed incorrectly. Fixed config backup: `/etc/nginx/conf.d/flashmuse.conf.bak.20260621025418-upload-size-fix`.
- Current intended upload limit for `main/api` HTTPS server block is `client_max_body_size 20m;`. Verify with `nginx -T | grep -n 'server_name main.venusface.com api.venusface.com\|client_max_body_size'` if upload 413 returns.
- Client-side upload diagnostics are logged through `/api/client-error` with `source="client-diagnostic"`. Use PM2 logs and Nginx access logs together when diagnosing upload failures. If users see only generic `上传失败`, check for nearby `client-diagnostic` entries first.

## Ali Static Server

- Role: static mirror for `_next/static`, generated files, and home assets.
- IP: `101.37.129.164`.
- Static root: `/var/www/flashmuse-static`.
- Local server info file exists outside the repo under `E:\project\【2】server\阿里服务器\阿里服务器.txt`. Do not copy passwords into Git or handover docs.
- Malaysia deploy script uses `/root/.ssh/flashmuse_to_ali_ed25519` internally to sync Ali static assets.

Observed during rebuild:

- Nginx service on Ali was active.
- `/var/www/flashmuse-static/_next/static` had timestamp `2026-06-20 20:22`, matching the latest deploy window.
- Ali local SNI checks returned 200 for one real `_next/static` file.
- 2026-06-26 after domain review passed, public HTTP/HTTPS access for `ali.venusface.com` and `static.venusface.com` was fixed and verified. HTTP now redirects to HTTPS for those hosts while `/.well-known/acme-challenge/` is served from `/var/www/letsencrypt`. HTTPS returns 200 for `https://ali.venusface.com/`, `https://static.venusface.com/flashmuse-cache-health`, a real `_next/static` file, and a known generated video.
- Ali certificate `flashmuse-ali-static` was reissued via HTTP-01 webroot and expires on `2026-09-24`. Renewal config uses `authenticator = webroot`; `certbot.timer` exists; deploy hook `/etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh` runs `nginx -t` and reloads Nginx after renewal; `certbot renew --dry-run --cert-name flashmuse-ali-static --no-random-sleep-on-renew` passed.

## Public Domains

- Main app: `https://main.venusface.com`.
- API: `https://api.venusface.com`.
- Ali fast entry and static domains: `https://ali.venusface.com`, `https://static.venusface.com`.

Verified during rebuild:

- `https://main.venusface.com/workspace` -> 200.
- `https://api.venusface.com/api/model-availability` -> 200.
- `https://main.venusface.com/admin` -> 200.

## GitHub Repository

- Current repository: `https://github.com/lookxun/FlashMuse_Agent`.
- Current local `origin`: `https://github.com/lookxun/FlashMuse_Agent.git`.
- Repository was renamed on 2026-06-26 from `lookxun/AI-Video-Assistant` to `lookxun/FlashMuse_Agent`.
- Latest pushed commit after the rename and local workflow sync: `1c9211d Sync local workflow updates and repo rename`.
- Repository-level Git identity is configured locally as `lookxun <lookxun@users.noreply.github.com>`. This only fixes local commits; pushing still requires valid GitHub credentials on the machine.
- GitHub CLI `gh` is not installed on this Windows machine. The 2026-06-26 repository rename used the GitHub REST API with the existing local Git credential; do not print or store credentials in docs.

## Deployment Rules

- Before deploying, inspect local `git status` and `git diff`.
- Do not overwrite unrelated local changes.
- For database changes, run Prisma migration deploy and generate on the server before app build when needed. Use the PM2 environment pattern above if direct env loading fails.
- Use the standard Malaysia deploy script unless there is a specific reason not to.
- The deploy script builds, restarts PM2, saves PM2 state, and syncs `_next/static` to Ali.
- Keep `.env`, `.env.local`, keys, SMTP credentials, and server passwords out of Git and handover docs.
- Deployment decision rule: if the change is low-risk and should not meaningfully affect current frontend users, the AI may deploy directly after local verification and then report the result.
- If deployment may interrupt active users, running generation tasks, database migrations, auth/session behavior, payment/credits, media persistence, or server availability, do not deploy first. Explain the risk to the user and ask for approval before deploying.
- Do not keep old blanket rules that say every deployment must be approved first. The current rule is risk-based: low-impact deploys can proceed; risky deploys require user confirmation.
- Nginx config changes are allowed when they fix a clear production issue, but always back up the config, run `nginx -t`, and reload rather than restart the server.
- For risky deploys that may affect workspace or asset display, run a before snapshot and after snapshot with `prod-deploy-snapshot.mjs`; do not rely only on HTTP 200 checks.

## Useful Production Checks

Run from local:

```powershell
ssh -i "E:\project\【2】server\马来西亚服务器\ByteplusVPS.pem" root@101.47.19.109
```

Run on Malaysia:

```bash
cd /var/www/flashmuse
pm2 status
curl -I https://main.venusface.com/workspace
curl -I https://api.venusface.com/api/model-availability
ls -1 .deploy-backups | tail
ls -1 .runtime/media-migration-logs | tail
node .runtime/deploy-checks/prod-deploy-snapshot.mjs snapshot manual-check
```
