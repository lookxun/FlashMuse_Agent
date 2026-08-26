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
    .replace(new RegExp(`@${escapeMentionRegExp(referenceName)}(?=$|[@\\s，。！？；;、])`, "g"), "")
    .replace(/[ \t]{2,}/g, " ");
  if (options?.trim) {
    next = next.replace(/\s+$/g, "").replace(/^\s+/g, "");
  }
  return next;
}

// 把某个引用名的【所有】@出现替换成给定文本（发给模型前清洗 @资产名 用）。
export function replaceMentionName(text: string, referenceName: string, replacement: string): string {
  if (!text || !referenceName) return text;
  return text.replace(new RegExp(`@${escapeMentionRegExp(referenceName)}(?=$|[@\\s，。！？；;、])`, "g"), replacement);
}

// ============ contenteditable 选区引擎（对话流输入框 / 工作流节点输入框共用） ============
//
// ⭐ 唯一权威（2026-08-02 收敛）：这套 DOM 选区函数原来在 chat-workbench(-core).tsx 和
// workflow-tldraw-canvas-inner.tsx 各存一份且已漂移 —— 工作流那份有「mention 原子化」处理
// （光标绝不落在 @文件名 蓝色 span 内部），对话流那份没有。两处编辑器渲染出的 mention span
// 结构完全一致（data-mention="true" + contentEditable=false），所以统一采用带原子化的版本。
// 两个编辑器都必须用它，禁止再各写一份。

/** 读取 contenteditable 的纯文本（BR→\n，\u00a0→空格，末尾占位 BR 不算，全空视为空串）。 */
export function getEditableText(element: HTMLElement) {
  let text = "";
  const walk = (node: Node) => {
    node.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        text += child.textContent ?? "";
        return;
      }
      if (child.nodeName === "BR") {
        if (!(child instanceof HTMLElement) || child.dataset.trailingBreak !== "true") text += "\n";
        return;
      }
      walk(child);
    });
  };
  walk(element);
  const normalizedText = text.replace(/\u00a0/g, " ");
  // Browsers keep an empty contenteditable focusable by inserting a lone <br>.
  // Treat that browser placeholder as empty input, not as a real newline.
  if (normalizedText.replace(/\n/g, "") === "") return "";
  return normalizedText;
}

/** 把纯文本按 \n 拆成 textNode + <br> 追加进编辑器。 */
export function appendEditorText(element: HTMLElement, text: string) {
  text.split("\n").forEach((line, index) => {
    if (index > 0) element.append(document.createElement("br"));
    if (line) element.append(document.createTextNode(line));
  });
}

function getMentionAwareNodeTextLength(node: Node): number {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent?.length ?? 0;
  if (node.nodeName === "BR") return node instanceof HTMLElement && node.dataset.trailingBreak === "true" ? 0 : 1;
  return Array.from(node.childNodes).reduce((sum, child) => sum + getMentionAwareNodeTextLength(child), 0);
}

/** 当前光标在「编辑器纯文本」里的偏移；选区不在此元素内/无选区时返回文本末尾。 */
export function getSelectionTextOffset(element: HTMLElement) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return getEditableText(element).length;
  const range = selection.getRangeAt(0);
  if (!element.contains(range.startContainer)) return getEditableText(element).length;

  let offset = 0;
  let found = false;
  const walk = (node: Node) => {
    if (found) return;

    // mention span 原子化：光标落在 @文件名 内部时，偏移按整个 mention 的末尾算。
    if (node instanceof HTMLElement && node.dataset.mention === "true") {
      offset += getMentionAwareNodeTextLength(node);
      if (node.contains(range.startContainer)) found = true;
      return;
    }

    if (node === range.startContainer) {
      if (node.nodeType === Node.TEXT_NODE) {
        offset += range.startOffset;
      } else {
        Array.from(node.childNodes).slice(0, range.startOffset).forEach((child) => { offset += getMentionAwareNodeTextLength(child); });
      }
      found = true;
      return;
    }
    if (node.nodeType === Node.TEXT_NODE || node.nodeName === "BR") {
      offset += getMentionAwareNodeTextLength(node);
      return;
    }
    node.childNodes.forEach(walk);
  };
  walk(element);
  return found ? offset : getEditableText(element).length;
}

/** 读取当前选区的文本起止偏移（start<=end）。无选区时 start===end（即光标位置）。用于"选中文本后点 @文件名 → 覆盖选中区"。 */
export function getSelectionTextRange(element: HTMLElement): { start: number; end: number } {
  const selection = window.getSelection();
  const fallback = getEditableText(element).length;
  if (!selection || selection.rangeCount === 0) return { start: fallback, end: fallback };
  const range = selection.getRangeAt(0);
  if (!element.contains(range.startContainer) || !element.contains(range.endContainer)) return { start: fallback, end: fallback };

  const offsetOf = (targetNode: Node, targetOffset: number): number => {
    let offset = 0;
    let found = false;
    const walk = (node: Node) => {
      if (found) return;
      if (node instanceof HTMLElement && node.dataset.mention === "true") {
        offset += getMentionAwareNodeTextLength(node);
        if (node.contains(targetNode)) found = true;
        return;
      }
      if (node === targetNode) {
        if (node.nodeType === Node.TEXT_NODE) {
          offset += targetOffset;
        } else {
          Array.from(node.childNodes).slice(0, targetOffset).forEach((child) => { offset += getMentionAwareNodeTextLength(child); });
        }
        found = true;
        return;
      }
      if (node.nodeType === Node.TEXT_NODE || node.nodeName === "BR") {
        offset += getMentionAwareNodeTextLength(node);
        return;
      }
      node.childNodes.forEach(walk);
    };
    walk(element);
    return found ? offset : fallback;
  };

  const a = offsetOf(range.startContainer, range.startOffset);
  const b = offsetOf(range.endContainer, range.endOffset);
  return a <= b ? { start: a, end: b } : { start: b, end: a };
}

/** 把光标放到「编辑器纯文本」的指定偏移处；mention span 原子化（只落在它前面或后面，绝不落进内部）。 */
export function setSelectionTextOffset(element: HTMLElement, offset: number) {
  const selection = window.getSelection();
  if (!selection) return;
  let remaining = Math.max(0, offset);
  const placeCaret = (container: Node): boolean => {
    const children = Array.from(container.childNodes);
    for (const child of children) {
      if (child instanceof HTMLElement && child.dataset.mention === "true") {
        const length = child.textContent?.length ?? 0;
        if (remaining <= length) {
          const range = document.createRange();
          if (remaining <= 0) range.setStartBefore(child);
          else range.setStartAfter(child);
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
          return true;
        }
        remaining -= length;
        continue;
      }

      if (child.nodeType === Node.TEXT_NODE) {
        const length = child.textContent?.length ?? 0;
        if (remaining <= length) {
          const range = document.createRange();
          range.setStart(child, remaining);
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
          return true;
        }
        remaining -= length;
        continue;
      }
      if (child.nodeName === "BR") {
        if (remaining <= 1) {
          const parent = child.parentNode;
          if (!parent) return false;
          const range = document.createRange();
          range.setStart(parent, children.indexOf(child) + 1);
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
          return true;
        }
        remaining -= 1;
        continue;
      }
      if (placeCaret(child)) return true;
    }
    return false;
  };
  if (placeCaret(element)) return;

  if (element.lastChild?.nodeName === "BR") {
    const range = document.createRange();
    range.setStart(element, element.childNodes.length);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    return;
  }

  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode() as Text | null;
  while (node) {
    const length = node.textContent?.length ?? 0;
    if (remaining <= length) {
      const range = document.createRange();
      range.setStart(node, remaining);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      return;
    }
    remaining -= length;
    node = walker.nextNode() as Text | null;
  }

  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

/** 光标处是否正处于「@正在输入」状态，返回 @ 的位置/已输入的查询串/光标。 */
export function getAtQueryAtCursor(text: string, cursorOffset: number) {
  const cursor = Math.min(Math.max(0, cursorOffset), text.length);
  const beforeCursor = text.slice(0, cursor);
  const match = beforeCursor.match(/@([^@\s，。！？；;、]*)$/);
  if (!match) return null;
  return { index: cursor - match[0].length, query: match[1] ?? "", cursor };
}

/** 同上，但查询串已经完整命中某个有效引用名时返回 null（已完成的 @文件名 不再当"正在输入"）。 */
export function getAtQueryAtCursorForReferences(text: string, cursorOffset: number, validReferences: Set<string>) {
  const query = getAtQueryAtCursor(text, cursorOffset);
  if (!query) return null;
  if (query.query && validReferences.has(query.query)) return null;
  return query;
}
