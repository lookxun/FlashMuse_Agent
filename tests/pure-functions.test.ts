/**
 * 纯函数单测：chat-workbench-core 里不依赖 DOM/React 的工具函数。
 * 第一批先覆盖「排序 / 标题 / 时间格式化 / 空会话判定 / 工作流编号规范化」这些纯逻辑。
 */
import { describe, expect, it } from "vitest";
import {
  ensureWorkflowItems,
  formatElapsedTime,
  formatMessageTime,
  getSessionTitle,
  isDeletedSession,
  isEmptySession,
  isModelIdentityQuestion,
  normalizeWorkflowCodesAndMediaNumbers,
  sortByUpdatedAtDesc,
} from "@/lib/chat/chat-workbench-core";

describe("sortByUpdatedAtDesc", () => {
  it("按 updatedAt 倒序，缺失的当 0，且不改原数组", () => {
    const input = [{ updatedAt: 3, id: "c" }, { id: "a" }, { updatedAt: 10, id: "b" }];
    const out = sortByUpdatedAtDesc(input);
    expect(out.map((x) => x.id)).toEqual(["b", "c", "a"]);
    expect(input.map((x) => x.id)).toEqual(["c", "a", "b"]); // 原数组不动
  });
});

describe("getSessionTitle", () => {
  it("16 字以内原样返回，超长截断加省略号", () => {
    expect(getSessionTitle("短标题")).toBe("短标题");
    expect(getSessionTitle("1234567890123456")).toBe("1234567890123456");
    expect(getSessionTitle("12345678901234567")).toBe("1234567890123456...");
  });
});

describe("formatElapsedTime", () => {
  it("格式 m:ss，负数当 0", () => {
    expect(formatElapsedTime(1000, 1000)).toBe("0:00");
    expect(formatElapsedTime(1000, 61_500)).toBe("1:00"); // 60.5s → floor 60
    expect(formatElapsedTime(1000, 1000 + 65_000)).toBe("1:05");
    expect(formatElapsedTime(5000, 1000)).toBe("0:00");
  });
});

describe("formatMessageTime", () => {
  it("输出 yyyy/M/d HH:mm", () => {
    const ts = new Date(2026, 7, 2, 9, 5).getTime();
    expect(formatMessageTime(ts)).toBe("2026/8/2 09:05");
  });
});

describe("isEmptySession", () => {
  const base = {
    title: "新对话",
    messages: [{ role: "system", content: "sys" }],
  };
  it("全新会话 = 空；有任何内容就不空", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(isEmptySession(base as any)).toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(isEmptySession({ ...base, draftInput: "打了字" } as any)).toBe(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(isEmptySession({ ...base, title: "对话_01" } as any)).toBe(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(isEmptySession({ ...base, messages: [{ role: "user", content: "hi" }] } as any)).toBe(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(isEmptySession({ ...base, uploadedFiles: [{ kind: "image" }] } as any)).toBe(false);
  });
});

describe("isDeletedSession", () => {
  it("有 deletedAt 即删", () => {
    expect(isDeletedSession({})).toBe(false);
    expect(isDeletedSession({ deletedAt: 123 })).toBe(true);
  });
});

describe("isModelIdentityQuestion", () => {
  it("识别『你是什么模型/你是谁』类问题，忽略标点空白", () => {
    expect(isModelIdentityQuestion("你是什么模型？")).toBe(true);
    expect(isModelIdentityQuestion("你 是 谁")).toBe(true);
    expect(isModelIdentityQuestion("帮我画一只猫")).toBe(false);
  });
});

describe("ensureWorkflowItems", () => {
  it("全删光了就补一个新的，有活的就不动", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const alive = [{ id: "w1", title: "工作流_01", createdAt: 1, updatedAt: 1 }] as any[];
    expect(ensureWorkflowItems(alive)).toBe(alive);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allDead = [{ id: "w1", title: "工作流_01", createdAt: 1, updatedAt: 1, deletedAt: 5 }] as any[];
    const out = ensureWorkflowItems(allDead);
    expect(out.length).toBe(2);
    expect(out[0].deletedAt).toBeUndefined();
  });
});

describe("normalizeWorkflowCodesAndMediaNumbers", () => {
  it("缺 workflowCode 的按最大编号续编；媒体编号下限 1", () => {
    const items = [
      { id: "a", title: "工作流_01", workflowCode: "w1", createdAt: 1, updatedAt: 1 },
      { id: "b", title: "工作流_02", createdAt: 1, updatedAt: 1 }, // 无 code → 应得 w2
      { id: "c", title: "工作流_03", nextImageNumber: 0.5, nextVideoNumber: -3, createdAt: 1, updatedAt: 1 },
    ];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out = normalizeWorkflowCodesAndMediaNumbers(items as any);
    expect(out[0].workflowCode).toBe("w1");
    expect(out[1].workflowCode).toBe("w2");
    expect(out[2].nextImageNumber).toBe(1);
    expect(out[2].nextVideoNumber).toBe(1);
  });
});
