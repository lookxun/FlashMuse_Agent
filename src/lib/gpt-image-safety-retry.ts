import { MODEL_REFUSED_MESSAGE, isModelRefusalText } from "@/lib/error-message";
import { isGptImage2AgentModel, isGptImage2Model } from "@/lib/models";

// ⭐ 唯一权威：gpt-5.4-image-2「模型拒绝生成 → AI 安全改写重试」的判定 + 多次改写编排。
// 对话流（chat-workbench）与工作流（workflow-tldraw-canvas-inner）共用这一份，禁止再各写一套。
// 只负责"判定 / 循环 / 去重 / 兜底改写词 / 最终文案"，真正的「调改写接口」和「发起生成」由调用方
// 以回调传入 —— 因为两处的 readJson（401 跳首页）与错误文案构建方式不同，收敛进来会改变现有行为。

// 失败文案里出现这些字样，说明大概率是模型侧内容拒绝，可以走安全改写。
// MODEL_REFUSED_MESSAGE 是 error-message.ts 映射出的稳定文案（新链路走它）；
// 其余关键词是历史链路留下的措辞（老接口会把拒绝原文原样透出），必须继续认。
const SAFETY_FAILURE_PATTERN = /图片平台没有返回图片|无法帮助|不能帮助|安全|隐私|未成年人|亲密|肖像|拒绝|不适合/i;

export function isGptImageSafetyFailure(options: { model?: string; errorText?: string; hasPriorAttempts?: boolean }) {
  // 两种接口的 gpt5.4image2（直连新接口 openai/gpt-5.4-image-2、GPT版老接口 ...-agent）都要能进安全改写。
  if (!isGptImage2Model(options.model) && !isGptImage2AgentModel(options.model)) return false;
  if (options.hasPriorAttempts) return true;
  const error = options.errorText ?? "";
  if (!error) return false;
  return error.includes(MODEL_REFUSED_MESSAGE) || isModelRefusalText(error) || SAFETY_FAILURE_PATTERN.test(error);
}

export function normalizeAttemptPrompt(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

export function getFallbackSafetyPrompt(originalPrompt: string, attempt: number, seenPrompts: Set<string>) {
  const mentionPrefix = originalPrompt.match(/^((?:@[^@\s，。！？；;、]+\s*)+)/)?.[0]?.trim() ?? "";
  const body = mentionPrefix ? originalPrompt.slice(mentionPrefix.length).trim() : originalPrompt.trim();
  const withPrefix = (nextBody: string) => [mentionPrefix, nextBody].filter(Boolean).join(" ").trim();
  const candidates = [
    withPrefix(body.replace(/(坐在|站在|躺在|走在|坐 到|坐到|在)/, "穿日常连衣裙$1")),
    withPrefix(body.replace(/(坐在|站在|躺在|走在|坐 到|坐到|在)/, "穿着得体$1")),
    withPrefix(body.replace(/(坐在|站在|躺在|走在|坐 到|坐到|在)/, "日常穿着$1")),
    withPrefix(`${body}，穿着得体`),
    withPrefix(`${body}，自然生活照风格`),
    withPrefix(`${body}，非性感、自然姿态`),
  ].map((item) => item.replace(/\s+/g, " ").trim()).filter(Boolean);
  const ordered = [...candidates.slice(Math.max(0, attempt - 1)), ...candidates.slice(0, Math.max(0, attempt - 1))];
  return ordered.find((item) => !seenPrompts.has(normalizeAttemptPrompt(item))) ?? "";
}

export const NO_NEW_SAFETY_PROMPT_MESSAGE = "没有找到不重复的安全改写提示词，请手动调整提示词后再试。";
export const SAFETY_RETRY_EXHAUSTED_MESSAGE = "AI 改写重试仍未成功，请调整提示词后再试。";

export type PromptSafetyRetryAttempt = {
  attempt: number;
  optimizedPrompt: string;
  optimizerModel: string;
  /** 累计已尝试的改写次数（含本次），用于写进 promptOptimization 记账 */
  attemptsUsed: number;
  attemptedPrompts: string[];
};

export type PromptSafetyRetryOptions = {
  originalPrompt: string;
  maxAttempts: number;
  /** 触发本次改写的原始失败文案，会作为 failureReason 传给改写接口 */
  initialError?: string;
  /** 之前已经试过的提示词（含原提示词），用于去重 */
  attemptedPrompts?: string[];
  /** 之前已经消耗过的改写次数，用于 attemptsUsed 累计 */
  previousAttemptsUsed?: number;
  /** 调改写接口（各自用自己的 readJson，以保留 401 跳首页与错误文案行为） */
  rewrite: (input: { originalPrompt: string; failureReason: string; previousPrompts: string[]; attemptIndex: number; maxAttempts: number }) => Promise<{ optimizedPrompt?: string; optimizerModel?: string }>;
  /** 用改写后的提示词发起一次生成：**resolve 视为成功、throw 视为本次仍失败** */
  generate: (attempt: PromptSafetyRetryAttempt) => Promise<void>;
  /** 每次新增改写词后回调，供调用方持久化 attemptedPrompts */
  onAttemptedPromptsChange?: (attemptedPrompts: string[]) => void;
  /** 把异常转成给用户看的文案（两处实现不同，必须由调用方传入） */
  toErrorText: (error: unknown) => string;
};

export async function runPromptSafetyRetry(options: PromptSafetyRetryOptions): Promise<{ ok: boolean; lastError: string; attemptedPrompts: string[] }> {
  const originalPrompt = options.originalPrompt.trim();
  let attemptedPrompts = [...(options.attemptedPrompts ?? []), originalPrompt].filter(Boolean);
  const seenPrompts = new Set(attemptedPrompts.map(normalizeAttemptPrompt));
  let lastError = options.initialError ?? "";

  try {
    for (let attempt = 1; attempt <= options.maxAttempts; attempt += 1) {
      let optimizedPrompt = "";
      let optimizerModel = "local-fallback";

      try {
        const rewriteResult = await options.rewrite({ originalPrompt, failureReason: lastError, previousPrompts: attemptedPrompts, attemptIndex: attempt, maxAttempts: options.maxAttempts });
        const aiPrompt = rewriteResult.optimizedPrompt?.trim() ?? "";
        if (aiPrompt && !seenPrompts.has(normalizeAttemptPrompt(aiPrompt))) {
          optimizedPrompt = aiPrompt;
          optimizerModel = rewriteResult.optimizerModel ?? "unknown";
        }
      } catch (error) {
        lastError = options.toErrorText(error);
      }

      if (!optimizedPrompt) {
        optimizedPrompt = getFallbackSafetyPrompt(originalPrompt, attempt, seenPrompts);
        optimizerModel = "local-fallback";
      }

      if (!optimizedPrompt) {
        lastError = NO_NEW_SAFETY_PROMPT_MESSAGE;
        options.onAttemptedPromptsChange?.(attemptedPrompts);
        continue;
      }

      seenPrompts.add(normalizeAttemptPrompt(optimizedPrompt));
      attemptedPrompts = [...attemptedPrompts, optimizedPrompt];
      options.onAttemptedPromptsChange?.(attemptedPrompts);

      try {
        await options.generate({ attempt, optimizedPrompt, optimizerModel, attemptsUsed: (options.previousAttemptsUsed ?? 0) + attempt, attemptedPrompts });
        return { ok: true, lastError, attemptedPrompts };
      } catch (error) {
        lastError = options.toErrorText(error);
        options.onAttemptedPromptsChange?.(attemptedPrompts);
      }
    }
  } catch (error) {
    lastError = options.toErrorText(error);
  }

  return { ok: false, lastError: lastError || SAFETY_RETRY_EXHAUSTED_MESSAGE, attemptedPrompts };
}
