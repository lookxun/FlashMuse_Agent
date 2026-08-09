/**
 * ⭐⭐ M040：把「红字文案映射幂等」固化成自动化用例（2026-08-09 第六十一次会话完成）。
 *
 * 为什么必须有这个测试（真实事故 = 正式服 B_123）：
 * `toUserErrorMessage()` 在这条链路上**必然被跑多遍** ——
 *   服务端 route 映射一次 → 客户端 `chat/chat-workbench-core.tsx` 再映射一次
 *   → 工作流节点 catch（`workflow-tldraw-canvas-inner.tsx`）还会再来一次。
 * 而我们自己的成品中文文案里常带着**会被兜底规则命中的关键词**（B_123 就是「版权」两个字
 * 命中裸 `copyright|版权` 兜底）→ 第二遍被重新包一层，变成
 * 「模型…拒绝出图…以下是模型返回的拒绝原因：“参考视频没能通过平台的版权检测…”」
 * = **审核视频的问题被拼进了拒绝出图的文案里**，把用户指向完全错误的排查方向（去改提示词）。
 *
 * ⭐ 唯一防线 = `error-message.ts` 顶部那道「幂等保护」白名单。这个测试就是它的看门狗：
 * **以后任何人新增/改动一句红字文案，只要二次映射会回到自己，这里就会红。**
 *
 * ⭐ 判据是二值的：`f(x) === f(f(x)) === f(f(f(x)))`（连跑 3 遍，AGENTS.md 铁律）。
 * ⛔ 故意**不 import 任何内部文案常量** —— 测的是"不变量"，不是"某句话长什么样"，
 *    这样以后改措辞不用改测试，而措辞改坏了幂等仍然会被抓住。
 */
import { describe, expect, it } from "vitest";
import { toUserErrorMessage } from "@/lib/error-message";

/**
 * 上游**真实原文**（全部来自 `error-message.ts` 的注释与线上诊断日志，⛔ 别改成臆造的英文）。
 * 每一条都必须满足"映射结果再映射还是它自己"。
 */
const REAL_UPSTREAM_MESSAGES: Array<[name: string, raw: string]> = [
  // —— 参考素材审核未过（B_123 的真凶就是第一条）——
  ["input video 版权", "input video may be related to copyright restrictions"],
  ["input image 版权", "input image may be related to copyright restrictions"],
  ["input audio 版权", "input audio may be related to copyright restrictions"],
  ["InputVideoSensitive 错误码", "InputVideoSensitiveContentDetected"],
  ["input image 真人", "The request failed because the input image may contain real person information"],
  ["送审被拒标记", "reference-review-failed"],
  // —— 成品被拒交付 ——
  ["output video 版权", "output video may be related to copyright restrictions"],
  ["成品图片敏感", "OutputImageSensitiveContentDetected"],
  // —— 输入提示词被判敏感 ——
  ["input text 敏感", "The request failed because the input text may contain sensitive information"],
  // —— 模型拒绝出图 ——
  ["safety system", "rejected by the safety system"],
  ["safety_violations + 客服尾巴", 'safety_violations=[sexual] rejected by the safety system. If you believe this is an error, contact us at help.openai.com'],
  ["模型中文拒绝", "抱歉，我不能帮助生成这个人物没穿衣服的图像。如果你愿意，我可以改为生成穿着服装的版本。"],
  // —— 参考图本身不合规 ——
  ["图片读不出", "Invalid image file or mode for image 1, please check your image file."],
  ["Kling 尺寸", "Image pixel is invalid"],
  ["尺寸区间", "height must be between 300px and 6000px"],
  ["尺寸下限", "expected the width to be at least 300px"],
  ["平台抓不到素材", "failed to download media from the provided url"],
  ["审核凭证失效", "specified asset asset-abc123 is not found"],
  ["比例超限", "aspect ratio must be between 0.4 and 2.5"],
  // —— 额度 / 限流 ——
  ["402 余额不足", "402 Insufficient credits"],
  ["insufficient_quota", "insufficient_quota"],
  ["Cloudflare 限流", "OpenAI was rate limited by Cloudflare (error code: 1015)"],
  ["裸 429", "429 Too Many Requests"],
  ["裸 quota", "quota exceeded"],
  // —— 密钥 ——
  ["我们没配密钥", "缺少 BytePlus API Key"],
  ["平台说密钥无效", "401 Unauthorized: invalid api key"],
  // —— 参数 ——
  ["时长不支持（带列表）", "unsupported output video duration, supported durations are [8]"],
  ["尺寸不支持", "unsupported size"],
  ["没有可用端点", "no endpoints found"],
  ["参数不支持", "no provider for transparent background"],
  ["请求过大", "413 request entity too large"],
  ["地区不可用", "403 not available in your region"],
  // —— 服务端环境 / 网络 ——
  ["缺二进制", "spawn curl ENOENT"],
  ["子进程失败", "Command failed: /app/node_modules/ffmpeg-static/ffmpeg -i input.mp4 out.mp4"],
  ["子进程里的网络失败", "Command failed: curl -s https://example.com; curl: (7) Failed to connect"],
  ["fetch failed", "fetch failed"],
  ["超时", "ETIMEDOUT"],
  ["自家连接池满", "Transaction API error: Unable to start a transaction in the given time."],
  // —— 网关 / 平台抖动 ——
  ["Cloudflare 520", "error code: 520"],
  ["上游空响应", "Provider returned an empty response"],
  ["返回 HTML 不是 JSON", "Unexpected token '<' , \"<!DOCTYPE \"... is not valid JSON"],
  ["500", "500 Internal Server Error"],
  ["无输出", "completed with no output"],
  // —— 模型只回文字不给图 ——
  ["没有返回图片 + 一段中文", "图片平台没有返回图片：你的要求前后矛盾，请重新描述。"],
];

describe("toUserErrorMessage 幂等性（M040 看门狗）", () => {
  it.each(REAL_UPSTREAM_MESSAGES)("「%s」连跑 3 遍结果不变", (_name, raw) => {
    const once = toUserErrorMessage(raw);
    const twice = toUserErrorMessage(once);
    const thrice = toUserErrorMessage(twice);
    // ⭐ 二值判据：第二遍、第三遍都必须和第一遍完全相等。
    expect(twice).toBe(once);
    expect(thrice).toBe(once);
  });

  it("带 (B_xxx) 前缀时：前缀不丢，且仍然幂等", () => {
    const once = toUserErrorMessage("(B_9) input video may be related to copyright restrictions");
    expect(once.startsWith("(B_9) ")).toBe(true);
    const twice = toUserErrorMessage(once);
    expect(twice).toBe(once);
  });

  /**
   * ⭐ 边界：走到函数末尾「中文原文透传 + 超长截断」那一路（普通 180 字 / 没有返回图片 500 字）。
   * 现在是幂等的，原因很微妙：`slice(0, 180) + "..."` 得到 183 字，第二遍再截 180 正好把 `...` 削掉又加回来。
   * ⛔ 所以**改 maxLength 或改省略号写法的人必须看这条** —— 一不小心就会变成每映射一次就短一截。
   */
  it.each([
    ["普通中文透传（180 字上限）", "模型说：" + "很".repeat(400)],
    ["没有返回图片（500 字上限）", "图片平台没有返回图片：" + "好".repeat(600)],
  ])("超长文案「%s」截断后仍然幂等", (_name, raw) => {
    const once = toUserErrorMessage(raw);
    const twice = toUserErrorMessage(once);
    const thrice = toUserErrorMessage(twice);
    expect(twice).toBe(once);
    expect(thrice).toBe(once);
  });

  it("截断边界逐长度扫描：176~200 字全部幂等", () => {
    for (let n = 176; n <= 200; n += 1) {
      const once = toUserErrorMessage("很".repeat(n));
      expect(toUserErrorMessage(once), `长度 ${n} 不幂等`).toBe(once);
    }
  });
});

describe("toUserErrorMessage 反向用例（⛔ 只测『我这条没串』不算通过）", () => {
  it("上游英文原文照样要被映射成中文，不许原样透出", () => {
    const out = toUserErrorMessage("input video may be related to copyright restrictions");
    expect(out).not.toBe("input video may be related to copyright restrictions");
    expect(out).toContain("参考视频");
  });

  it("B_123 回归：参考视频没过审 ⛔ 不许被说成「模型拒绝出图」", () => {
    const once = toUserErrorMessage("input video may be related to copyright restrictions");
    const twice = toUserErrorMessage(once);
    // 这两句是当年串台的铁证：二次映射后出现了"拒绝出图"和"模型返回的拒绝原因"
    expect(twice).not.toContain("拒绝出图");
    expect(twice).not.toContain("拒绝原因");
    expect(twice).toContain("参考视频");
  });

  it("素材类型要跟着上游原文变（图片/视频/音频各自对应）", () => {
    expect(toUserErrorMessage("input image may be related to copyright restrictions")).toContain("参考图片");
    expect(toUserErrorMessage("input video may be related to copyright restrictions")).toContain("参考视频");
    // ⚠️ audio 这条历史上漏写过（只写了 image|video），会掉进裸 copyright 兜底被说成"模型拒绝"
    expect(toUserErrorMessage("input audio may be related to copyright restrictions")).toContain("参考音频");
  });

  it("句中假冒不许被当成「已是成品文案」而放过（幂等保护必须锚定开头）", () => {
    // 前面挂了一段别的话 → 不是我们映射出来的成品 → 必须被重新映射，而不是原样返回
    const fake = "上游返回：参考视频没能通过平台的版权检测（可能涉及真人、隐私或版权）";
    expect(toUserErrorMessage(fake)).not.toBe(fake);
  });

  it("近似句不许被误判成成品文案（「通过了」和「没能通过」是反的）", () => {
    const nearMiss = "参考视频通过了版权检测，但成品另有问题";
    expect(toUserErrorMessage(nearMiss)).not.toBe(nearMiss);
  });

  it("成品视频/图片被拒 ⛔ 不许被错怪成「参考素材」的问题", () => {
    expect(toUserErrorMessage("OutputImageSensitiveContentDetected")).toContain("成品图片");
    // 成品那一路绝不能出现"请更换参考素材"这种误导
    expect(toUserErrorMessage("OutputImageSensitiveContentDetected")).not.toContain("参考图片没能通过");
  });

  it("限流 ⛔ 不许说成余额不足（钱是够的，说充值会让用户白催）", () => {
    const out = toUserErrorMessage("OpenAI was rate limited by Cloudflare (error code: 1015)");
    expect(out).not.toContain("充值");
  });

  it("我们自己没配密钥 ⛔ 不许说成「密钥已过期，请更新密钥」", () => {
    const out = toUserErrorMessage("缺少 BytePlus API Key");
    expect(out).toContain("管理员");
    expect(out).not.toContain("已过期");
  });
});
