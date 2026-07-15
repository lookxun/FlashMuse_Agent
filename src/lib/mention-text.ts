// 统一的 @文件名 提及（mention）纯逻辑：匹配 / 删除 / 移除名字。
// 铁律（见 AGENTS.md）：能统一的一律统一。此前对话流输入框、对话流消息展示、
// 工作流输入框、后台弹窗各写了一份几乎逐字节相同的匹配逻辑，已收敛到这里，四处共用。
// 只放纯逻辑（返回 range / 处理字符串），渲染层各处自行处理（contentEditable DOM /
// React 缩略图 / 纯蓝字三种形态不同，不强行合并）。

// 全站 @文件名 蓝色统一色值。
export const MENTION_ACCENT = "#367cee";

export interface MentionRange {
  start: number;
  end: number;
  name: string;
}

export interface MentionMatchOptions {
  // 是否额外匹配"去掉文件后缀"的变体（后台弹窗用：提示词里常写 @D68，而参考名是 D68.jpg）。
  // 前端三处的名字是无后缀的终生ID，保持 false 以保证行为逐字节不变。
  stripExtension?: boolean;
}

function escapeMentionRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// 由传入的名字集合生成"用于匹配的候选名 → 展示名"映射，按候选名长度降序，
// 防止 @image_1 抢先命中而漏掉更长的 @image_10。
function buildCandidateNames(names: Iterable<string>, options?: MentionMatchOptions): Array<{ candidate: string; name: string }> {
  const seen = new Set<string>();
  const list: Array<{ candidate: string; name: string }> = [];
  for (const raw of names) {
    const name = (raw ?? "").trim();
    if (!name) continue;
    const candidates = [name];
    if (options?.stripExtension) {
      const noExt = name.replace(/\.[a-zA-Z0-9]{1,5}$/, "");
      if (noExt && noExt !== name) candidates.push(noExt);
    }
    for (const candidate of candidates) {
      const key = `${candidate}\u0000${name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      list.push({ candidate, name });
    }
  }
  return list.sort((left, right) => right.candidate.length - left.candidate.length);
}

// 扫描文本，返回所有 @文件名 命中的区间（含 @ 本身）。
// range.name 是原始展示名（去后缀命中时仍返回带后缀的原名，供缩略图按名查引用）。
export function getMentionRanges(value: string, names: Iterable<string>, options?: MentionMatchOptions): MentionRange[] {
  const candidates = buildCandidateNames(names, options);
  const ranges: MentionRange[] = [];
  if (candidates.length === 0) return ranges;

  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== "@") continue;
    const matched = candidates.find((item) => value.startsWith(`@${item.candidate}`, index));
    if (!matched) continue;
    const end = index + matched.candidate.length + 1;
    ranges.push({ start: index, end, name: matched.name });
    index = end - 1;
  }

  return ranges;
}

// 删除操作：光标处（向前/向后）是否落在某个 mention 区间上，返回该区间以便整体删除。
export function getMentionRangeForDeletion(
  value: string,
  cursorOffset: number,
  direction: "backward" | "forward",
  names: Iterable<string>,
  options?: MentionMatchOptions,
): MentionRange | undefined {
  const probeOffset = direction === "backward" ? cursorOffset - 1 : cursorOffset;
  if (probeOffset < 0 || probeOffset >= value.length) return undefined;
  return getMentionRanges(value, names, options).find((range) => probeOffset >= range.start && probeOffset < range.end);
}

// 从提示词里抽出所有 @后面的名字（不校验是否有效引用）。
export function getMentionNames(text: string): string[] {
  return [...text.matchAll(/@([^@\s，。！？；;、]+)/g)].map((match) => match[1]);
}

// 删除某个引用名的【所有】@出现（同名可多次、可紧贴中文、可相邻）。
// trim=true 时额外去掉首尾空白（对话流用）；false 只压缩中间多余空格（工作流用）。
export function removeMentionName(text: string, referenceName: string, options?: { trim?: boolean }): string {
  if (!text || !referenceName) return text;
  let next = text
    .replace(new RegExp(`@${escapeMentionRegExp(referenceName)}(?=$|[\\s，。！？；;、])`, "g"), "")
    .replace(/[ \t]{2,}/g, " ");
  if (options?.trim) {
    next = next.replace(/\s+$/g, "").replace(/^\s+/g, "");
  }
  return next;
}

// 把某个引用名的【所有】@出现替换成给定文本（发给模型前清洗 @资产名 用）。
export function replaceMentionName(text: string, referenceName: string, replacement: string): string {
  if (!text || !referenceName) return text;
  return text.replace(new RegExp(`@${escapeMentionRegExp(referenceName)}(?=$|[\\s，。！？；;、])`, "g"), replacement);
}
