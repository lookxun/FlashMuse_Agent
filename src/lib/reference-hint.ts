// Shared reference-image hint builder used by conversation flow, asset generation, Agent, and workflow.
//
// The hint is a client-side instruction appended to the generation prompt when reference images exist.
// It is NOT added by any model or the backend. Historically it forced the model to strictly preserve
// EVERY reference image's subject/clothing/scene. That is wrong when the user only wants to loosely
// "参考" (reference) a specific image (e.g. borrow its motion/camera/style), not reproduce it.
//
// New rule (per product decision): classify each reference PER the user's prompt intent.
//   - If the user said "参考/参照/借鉴/..." about a given @mention, that reference is LOOSE (not absolute).
//   - Otherwise the reference is ABSOLUTE use (must preserve its subject/character/clothing/scene).
// Example: "功夫大师@asset_1_role 跳一段舞蹈，人物动作和运镜参考@下载.mp4 不要背景音乐"
//   → @asset_1_role = absolute (keep the character), @下载.mp4 = loose (only reference its motion/camera).

const REFERENCE_INTENT_KEYWORDS = ["参考", "参照", "借鉴", "参看", "仿照", "模仿", "参见"];

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// A reference @mention is "loose" when a reference-intent keyword appears in the same clause,
// immediately before the @mention. Clause boundaries are CJK/ASCII sentence punctuation, newlines,
// and other @mentions (so a keyword only applies to the mention it directly precedes).
function isLooseReferenceMention(prompt: string, name: string): boolean {
  if (!prompt || !name) return false;
  const pattern = new RegExp(`@${escapeRegExp(name)}`, "g");
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(prompt)) !== null) {
    const before = prompt.slice(0, match.index);
    const clauseMatch = before.match(/[^，。；！？、,.;!?\n@]*$/);
    const clause = clauseMatch ? clauseMatch[0] : before;
    if (REFERENCE_INTENT_KEYWORDS.some((keyword) => clause.includes(keyword))) return true;
  }
  return false;
}

// referenceNames are the reference-image names in the same order they are sent to the model
// (参考图1, 参考图2, ...). A name may be undefined/empty (e.g. an upload with no @mention),
// which is always treated as absolute since intent cannot be inferred.
export function buildReferenceHint(prompt: string, referenceNames: Array<string | undefined>): string {
  const count = referenceNames.length;
  if (count <= 0) return "";

  const labels = Array.from({ length: count }, (_, index) => `参考图${index + 1}`);
  const looseFlags = referenceNames.map((name) => (name ? isLooseReferenceMention(prompt, name) : false));
  const absoluteLabels = labels.filter((_, index) => !looseFlags[index]);
  const looseLabels = labels.filter((_, index) => looseFlags[index]);
  const order = `参考图顺序：${labels.join("，")}。`;

  if (looseLabels.length === 0) {
    return `${order}生成时必须分别保留这些参考图对应的主体、人物特征、服装和场景关系，不要把人物或场景替换成无关内容。`;
  }
  if (absoluteLabels.length === 0) {
    return `${order}这些参考图仅作为参考（例如动作、运镜、风格、构图等），可自由发挥，不必严格保留其人物或场景。`;
  }
  return `${order}其中${absoluteLabels.join("，")}需严格保留其对应的主体、人物特征、服装和场景，不要把人物或场景替换成无关内容；${looseLabels.join("，")}仅作为参考（例如动作、运镜、风格、构图等），可自由发挥，不必保留其人物或场景。`;
}
