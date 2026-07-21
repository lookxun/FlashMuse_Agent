# GPT Image Prompt Optimization

Last updated: 2026-07-01 China time.

## Status

- This is a local first-version mini project for workflow mode only.
- Scope is intentionally narrow: workflow image nodes using `openai/gpt-5.4-image-2`.
- It handles the case where GPT Image refuses generation or returns no image with a safety-style refusal message.
- It is framed as compliant safety rewriting, not bypassing review.

## First Version Implemented Locally

- Failed workflow image cards for eligible `GPT-5.4 Image 2` failures keep the original red error text.
- The middle failed-card action changes from plain `修改后重试` to an explanation plus three buttons: `AI改写重试3次`, `AI改写重试5次`, and `AI改写重试10次`.
- Clicking a retry button keeps the node in waiting/running state and tries up to the chosen number.
- Each attempt calls a text optimizer first, then calls the existing `/api/image` path. The image generation, credits, media save queue, workflow asset persistence, and preview flow stay on the existing chain.
- Text optimizer fallback order is `openai/gpt-5.5`, `openai/gpt-5.4`, then `byteplus:chat.seed-2-0-pro`.
- The optimizer is instructed to preserve all `@资产名`, preserve original intent, avoid duplicate prompt attempts, and only rewrite toward safer wording where appropriate.
- Important current rule from user feedback: AI rewriting is not general prompt optimization. It must be a minimal patch on top of the user's original prompt. The goal is to make the smallest possible change that may avoid a GPT Image safety refusal while keeping the reference image effective. If a tiny change can work, do not do a bigger rewrite.
- First retry should only add a very short safety phrase, roughly 4-12 Chinese characters, such as `穿日常连衣裙`, `穿着得体`, `日常穿着`, or `自然生活照风格`. This is based on the user's successful manual fix: original `@Soo-ji 坐在客厅沙发上。手里有一只白猫` failed, while `@Soo-ji 穿日常连衣裙坐在客厅沙发上。手里有一只白猫` succeeded and still preserved face and clothing well.
- Later retries may gradually add constraints, but still should stay short and avoid rewriting the whole prompt. Do not change the scene, action, prop, character identity, or clothing style unless unavoidable.
- Clothing rule: if the reference image clothing is not rejected before generation, assume it may be usable. Preserve clothing color, material, style, silhouette, and overall look as much as possible. If safety risk is suspected, only make a small conservative adjustment such as adding `日常`, `得体`, `保守版`, or reducing exposure wording. Do not replace reference clothing with a totally different outfit.
- The node stores attempted prompts while failures continue so future retries avoid repeating the same wording.
- On success, the node and `MediaAsset.sourcePrompt` use the real successful generation prompt. The original user prompt, successful optimized prompt, optimizer model, and attempts used are stored as optimization metadata.
- A new table `GptImagePromptOptimizationCase` stores successful cases for later analysis. Local migration `20260701043000_gpt_image_prompt_optimization_cases` was applied successfully on 2026-07-01.
- Admin now has a left-nav tab `GPT生图优化` above `服务器信息`. It lists attempts used, original prompt, successful AI prompt, thumbnail, generation time, user, and optimizer model. Hovering the thumbnail shows a larger image.

## Latest Local Fixes During Testing

- Failed-card middle explanation was adjusted: the explanation block remains centered overall, but its text is left-aligned, starts with `information-2-line`, and the three retry buttons have larger spacing. Text was changed from `由系统尝试` to `由AI尝试`.
- The retry loop originally could get stuck in a waiting card because `attemptedPrompts.push(...)` mutated a frozen workflow/tldraw state array and threw `TypeError: Cannot add property 4, object is not extensible`. This is fixed by replacing arrays immutably and adding an outer catch so `isRunning` is cleared on unexpected errors.
- User observed a successful AI rewrite that changed clothing too much and only kept the face. Rules were revised to minimal-patch rewriting, with strong reference-clothing preservation.
- Local OpenRouter behavior can differ from production because the user is in China. Diagnostics showed direct fetch to OpenRouter can return `403 This model is not available in your region`, then curl fallback can fail with Windows `schannel: failed to receive handshake, SSL/TLS connection failed`. Production Malaysia server is expected to avoid this local region issue. Future UX should prefer the original region-unavailable error over later curl fallback network errors.
- Fixed cumulative attempt counting after user testing. If a user clicks `AI改写重试3次`, all three attempts fail, then clicks `AI改写重试3次` again and the first attempt succeeds, the saved/admin value should be `4 次`, not `3 次`. The implementation now counts prior unique optimized attempts excluding the original prompt and adds the current successful attempt index.
- Admin `GPT生图优化` was refined: information and thumbnail are separate columns, the info column contains media name/parameters/time/user/optimizer, and thumbnail hover preview uses browser-boundary-aware portal placement.

## Related Local Workflow UI Fixes From Same Session

- Workflow asset-reference image format validation was fixed. Asset references may have names without `.jpg/.png`, so workflow submit validation now falls back to the media URL extension instead of rejecting with `当前模型不支持该图片格式`.
- Real file upload format detection in workflow and conversation now falls back to MIME type when a filename lacks an extension. Shared `getFileExtension()` was also corrected to avoid treating an entire no-dot filename as an extension.
- tldraw default snap/reference-line color was changed through the default theme `snap` color to pure green `#00ff00`. The default tldraw snap implementation remains in use; no custom reference-line geometry or dashed-line implementation was added.
- Workflow failed-card red error text now wraps to multiple lines first and only clips when card height is insufficient, instead of truncating immediately with ellipsis.

## Important Files

- `src/components/workflow-tldraw-canvas-inner.tsx`
- `src/components/workflow-tldraw-canvas.tsx`
- `src/app/api/workflow-prompt-optimization/rewrite/route.ts`
- `src/app/api/workflow-prompt-optimization/cases/route.ts`
- `src/lib/openrouter.ts`
- `src/app/admin/page.tsx`
- `prisma/schema.prisma`
- `prisma/migrations/20260701043000_gpt_image_prompt_optimization_cases/migration.sql`

## Second Phase To Do Later

- Add automatic analysis of successful cases: summarize what kinds of prompt edits improve success while preserving user intent.
- Store the rolling analysis report in DB or system settings.
- Feed the analysis report into future optimizer calls before rewriting.
- Add success/failure rate statistics by model, retry count, and prompt pattern.
- Add cost and latency reporting for 3/5/10 retry usage.
- After online testing proves the workflow version useful, consider copying the feature to conversation-flow image generation.
- Consider a user-facing cost warning if 5/10 retries are expensive in practice.

## Cautions

- Do not describe this as bypassing review or bypassing safety policy.
- Do not auto-modify the user's prompt without explicit button click.
- Do not remove the original red model error; it is useful for diagnosis.
- Do not save every failed prompt attempt permanently after success unless the user later asks for deeper analytics. First version only preserves successful case summaries.
- Do not let AI rewrite replace the user's prompt with a broad safe alternative on the first attempt. It must start with the least invasive edit and only become slightly stronger over later attempts.
