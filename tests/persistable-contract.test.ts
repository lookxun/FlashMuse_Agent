/**
 * ⭐⭐ 契约测试：getPersistableSessions / getPersistableWorkflowItems 的输出里
 * 绝不允许出现任何「运行时临时字段」。
 *
 * 为什么值得一个测试：这类 bug 已经犯过三次（上传进度落库卡 47%、promptLoading 落库
 * 永久转圈、uploadedFiles 漏剥）。剥字段靠手写函数，每加一个临时字段都可能漏 ——
 * 这个测试把「禁止落库的字段名单」变成硬约束：谁以后新增临时字段忘了剥，测试当场红。
 */
import { describe, expect, it } from "vitest";
import { getPersistableSessions, getPersistableWorkflowItems } from "@/lib/chat/chat-workbench-core";

/** 禁止落库的字段名（出现在输出任何层级都算失败） */
const FORBIDDEN_KEYS = [
  "uploadProgress",
  "uploadPreviewUrl",
  "uploadStatus",
  "promptLoading",
  "pendingRequest",
];

/** 深度遍历，收集所有「值不是 undefined」的 key（undefined 键在 JSON 落库时会被丢弃，不算泄露） */
function collectKeys(value: unknown, into: Set<string>) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectKeys(item, into));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (child === undefined) continue;
      into.add(key);
      collectKeys(child, into);
    }
  }
}

/** 深度遍历，收集所有字符串值 */
function collectStrings(value: unknown, into: string[]) {
  if (typeof value === "string") {
    into.push(value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectStrings(item, into));
    return;
  }
  if (value && typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach((child) => collectStrings(child, into));
  }
}

function expectNoTransientState(output: unknown, label: string) {
  const keys = new Set<string>();
  collectKeys(output, keys);
  for (const forbidden of FORBIDDEN_KEYS) {
    expect(keys.has(forbidden), `${label} 输出里不允许出现临时字段 ${forbidden}`).toBe(false);
  }
  const strings: string[] = [];
  collectStrings(output, strings);
  for (const value of strings) {
    expect(value.startsWith("blob:"), `${label} 输出里不允许出现 blob: 地址（刷新即失效）`).toBe(false);
  }
}

// ---------- 测试数据（只填测试关心的字段，其余不强求） ----------

const workflowNodeWithTransient = {
  id: "node-1",
  kind: "image",
  x: 0,
  y: 0,
  data: {
    prompt: "一只猫",
    images: ["/generated/images/a.png"],
    uploadProgress: 47, // ← 上传中，绝不能落库
    uploadPreviewUrl: "blob:http://localhost/xxx",
    promptLoading: true, // ← 「使用提示词」转圈态，绝不能落库
  },
};

const cleanNode = {
  id: "node-2",
  kind: "video",
  x: 100,
  y: 0,
  data: { prompt: "一只狗", videoUrl: "/generated/videos/b.mp4" },
};

const workflowWithTransientNodes = {
  id: "wf-1",
  title: "工作流_01",
  workflowCode: "w1",
  createdAt: 1,
  updatedAt: 2,
  nextImageNumber: 1,
  nextVideoNumber: 1,
  canvas: {
    nodes: [workflowNodeWithTransient, cleanNode],
    edges: [],
    historicalMediaNodes: [{ ...workflowNodeWithTransient, id: "node-h1" }],
  },
};

const trimmedWorkflow = {
  id: "wf-2",
  title: "工作流_02",
  workflowCode: "w2",
  createdAt: 1,
  updatedAt: 2,
  nextImageNumber: 1,
  nextVideoNumber: 1,
  canvasTrimmed: true,
  canvas: { nodes: [cleanNode], edges: [] }, // 骨架版绝不允许带着 canvas 回传
};

const sessionWithTransient = {
  id: "s-1",
  title: "对话_01",
  createdAt: 1,
  updatedAt: 2,
  draftInput: "草稿",
  uploadedImages: [{ url: "blob:http://localhost/y.png", uploadProgress: 10 }],
  uploadedFiles: [
    // 上传中的整条不落库
    { kind: "video", url: "blob:http://localhost/z.mp4", uploadStatus: "uploading", uploadProgress: 47, status: "reading" },
    // 已完成的：剥临时字段、剥 blob 地址，保留条目
    { kind: "document", name: "说明.pdf", url: "/generated/documents/d.pdf", uploadStatus: "ready", uploadProgress: 100, progress: 100, error: "曾经报过错" },
    { kind: "image", name: "图.png", url: "/generated/images/e.png" },
  ],
  pendingRequest: { id: "p-0", messages: [] },
  pendingRequests: [
    {
      id: "p-1",
      messages: [{ role: "user", content: "画个猫", images: ["data:image/png;base64,AAA", "/generated/images/ok.png"] }],
      referenceImages: ["data:image/png;base64,BBB", "/generated/images/ref.png"],
    },
  ],
  messages: [
    { role: "user", content: "你好", createdAt: 1, images: ["data:image/png;base64,CCC", "/generated/images/m1.png"] },
    { role: "assistant", content: "在", createdAt: 2 },
  ],
};

// ---------- 用例 ----------

describe("契约：getPersistableWorkflowItems 输出不含临时字段", () => {
  it("节点的 uploadProgress / uploadPreviewUrl / promptLoading 全部剥掉（含历史媒体节点）", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out = getPersistableWorkflowItems([workflowWithTransientNodes] as any);
    expectNoTransientState(out, "workflowItems");
    // 正常内容不受影响
    const wf = out.find((item) => item.id === "wf-1");
    expect(wf?.canvas?.nodes).toHaveLength(2);
    expect(wf?.canvas?.nodes?.[0]?.data?.prompt).toBe("一只猫");
    expect(wf?.canvas?.nodes?.[0]?.data?.images).toEqual(["/generated/images/a.png"]);
  });

  it("canvasTrimmed 的骨架版工作流连 canvas 键都不能有", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out = getPersistableWorkflowItems([workflowWithTransientNodes, trimmedWorkflow] as any);
    const trimmed = out.find((item) => item.id === "wf-2");
    expect(trimmed).toBeTruthy();
    expect("canvas" in trimmed!).toBe(false);
  });
});

describe("契约：getPersistableSessions 输出不含临时字段", () => {
  it("uploadedImages 必为 undefined；pendingRequest 必为 undefined", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out = getPersistableSessions([sessionWithTransient] as any);
    expectNoTransientState(out, "sessions");
    const s = out.find((item) => item.id === "s-1");
    expect(s?.uploadedImages).toBeUndefined();
  });

  it("上传中的文件整条不落库；已完成的剥临时字段、剥 blob 地址", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out = getPersistableSessions([sessionWithTransient] as any);
    const s = out.find((item) => item.id === "s-1");
    // 3 条里：上传中的 1 条被整条丢掉，剩 2 条
    expect(s?.uploadedFiles).toHaveLength(2);
    const doc = s?.uploadedFiles?.[0];
    expect(doc && typeof doc === "object" && "name" in doc ? (doc as { name?: string }).name : "").toBe("说明.pdf");
    expect(doc && typeof doc === "object" && "url" in doc ? (doc as { url?: string }).url : "").toBe("/generated/documents/d.pdf");
  });

  it("消息和 pendingRequests 里的 data: 图片被过滤，http 路径保留", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out = getPersistableSessions([sessionWithTransient] as any);
    const s = out.find((item) => item.id === "s-1");
    expect(s?.messages?.[0]?.images).toEqual(["/generated/images/m1.png"]);
    const pending = s?.pendingRequests?.[0];
    expect(pending?.referenceImages).toEqual(["/generated/images/ref.png"]);
    expect(pending?.messages?.[0]?.images).toEqual(["/generated/images/ok.png"]);
  });

  it("干净输入 → 输出内容不变（不能误伤正常数据）", () => {
    const clean = {
      id: "s-2",
      title: "对话_02",
      createdAt: 1,
      updatedAt: 3,
      draftInput: "继续画",
      messages: [{ role: "user", content: "画一只狗", createdAt: 1, images: ["/generated/images/x.png"] }],
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out = getPersistableSessions([clean] as any);
    const s = out.find((item) => item.id === "s-2");
    expect(s?.title).toBe("对话_02");
    expect(s?.draftInput).toBe("继续画");
    expect(s?.messages?.[0]?.images).toEqual(["/generated/images/x.png"]);
  });
});
