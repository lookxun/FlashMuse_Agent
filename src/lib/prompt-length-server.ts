import { appendGenerationDiagnosticsLog } from "@/lib/generation-diagnostics-log";
import { countPromptLength, getPromptMaxLength, type PromptLengthContext } from "@/lib/prompt-length";
import { getPromptLengthOverrides } from "@/lib/system-settings";

/**
 * 服务端「提示词超字数」**只记日志、不拦截**（2026-08-09 用户拍板 Q2 = 先观察几天）。
 *
 * 背景：前端从这一版起**不再静默截断**用户的字（学即梦），所以超限文本理论上真的可能到达后端
 * （切模型后草稿超限、程序化提交、直调接口）。⛔ 先不拦 —— 一上来就拦，万一某个模型的默认值配得偏小，
 * 用户会突然发不出去；先在 `.runtime/generation-diagnostics-log.jsonl` 里数一数真实规模。
 *
 * ⭐ 判据（观察几天后再决定要不要开拦截）：`grep -c '"prompt-length-over-limit"'`。
 * ⭐ 一律喂 `sourcePrompt`（用户原话）—— 发给模型的 `prompt` 是拼过的（规则文本 + 参考图 hint），
 *   用它会把我们自己拼进去的字算成用户的字（同 AGENTS.md 那条审核铁律）。
 * ⛔ 这是唯一实现，image / video 两条路共用，别各写一份。
 */
export function logPromptLengthOverLimit(params: {
  context: PromptLengthContext;
  sourcePrompt: string;
  requestId?: string;
  userId?: string;
  model?: string;
  creditSource?: string;
  flow?: string;
}) {
  const maxLength = getPromptMaxLength(params.context, getPromptLengthOverrides());
  const used = countPromptLength(params.sourcePrompt);
  if (used <= maxLength) return;

  void appendGenerationDiagnosticsLog({
    event: "prompt-length-over-limit",
    requestId: params.requestId,
    userId: params.userId,
    mode: params.context.mode === "video" ? "video" : "image",
    model: params.model,
    extra: { used, maxLength, over: used - maxLength, creditSource: params.creditSource, flow: params.flow, promptMode: params.context.mode },
  });
}
