import { DEFAULT_IMAGE_MODEL } from "@/lib/models";
import { getUploadRule, type UploadKindRule, type UploadRule } from "@/lib/upload-rules";

type UploadRuleRow = {
  scene: string;
  model: string;
  rule: UploadRule;
  note: string;
  details?: Partial<Record<"image" | "document" | "video" | "audio", string>>;
  incomplete?: Partial<Record<"image" | "document" | "video" | "audio", string>>;
};

const bytePlusImageReferenceRuleText = "图片参考完整规则：jpg/jpeg/png/webp/bmp/tiff/tif/gif/heic/heif；单张≤30MB；上传图片和 @资产引用合并计数；按用户显式 @ 顺序传入，并去重。";
const bytePlusImageOfficialLimitText = "火山官方 URL 参考图上限为 14 张；当前前端本地 Base64 入口为控制请求体，限制为 6 张。";
const seedanceImageReferenceRuleText = "图片参考完整规则：jpg/jpeg/png/webp/bmp/tiff/tif/gif/heic/heif；最多 9 张；单张≤30MB；普通多参考按 reference_image 传入；首帧模式只用第 1 张 first_frame；首尾帧模式用前 2 张 first_frame/last_frame；单独尾帧文案不发送 last_frame，按普通参考图处理；不与参考视频/音频数量互斥。";

const uploadRuleRows: UploadRuleRow[] = [
  {
    scene: "通用模式",
    model: "通用 Agent 规则",
    rule: getUploadRule({ mode: "general", transportMode: "local-base64" }),
    note: "用于通用问答、任务规划、看图理解和后续生图/生视频规划；当前入口允许图片和文档，不开放视频/音频上传。",
  },
  {
    scene: "Agent 模式",
    model: "通用安全规则",
    rule: getUploadRule({ mode: "agent", transportMode: "local-base64" }),
    note: "用于普通对话、规划、理解上传内容。",
  },
  {
    scene: "对话流图片 / 资产库图片",
    model: "OpenRouter 图片模型",
    rule: getUploadRule({ mode: "image", modelId: DEFAULT_IMAGE_MODEL, transportMode: "local-base64" }),
    note: "Seedream / Gemini / GPT 图片模型统一保守限制；GPT-5.4 Image 2 额外允许 1 个文件。",
    incomplete: { document: "GPT 文件输入未做实；当前文档仅读取文本拼入提示词。" },
  },
  {
    scene: "对话流图片 / 资产库图片",
    model: "BytePlus 图片模型（本地测试）",
    rule: getUploadRule({ mode: "image", modelId: "byteplus:conversation-image.seedream-4-5", transportMode: "local-base64" }),
    note: "当前本地继续 Base64 打包测试，先限制 6 张。",
    details: { image: `${bytePlusImageReferenceRuleText}${bytePlusImageOfficialLimitText}` },
    incomplete: { image: "特殊格式 heic/heif/tiff/bmp/gif 仅规则记录，浏览器预览未完整做实。" },
  },
  {
    scene: "对话流图片 / 资产库图片",
    model: "BytePlus 图片模型（服务器 URL）",
    rule: getUploadRule({ mode: "image", modelId: "byteplus:conversation-image.seedream-4-5", transportMode: "server-url" }),
    note: "部署到公网服务器后，上传文件生成服务器 URL，可按官方 14 张上限。",
    details: { image: `${bytePlusImageReferenceRuleText}服务器 URL 模式按火山官方上限最多 14 张。` },
    incomplete: { image: "服务器 URL 传模型链路未做实。" },
  },
  {
    scene: "对话流视频",
    model: "OpenRouter Seedance 视频",
    rule: getUploadRule({ mode: "video", modelId: "bytedance/seedance-2.0-fast", transportMode: "local-base64" }),
    note: "当前仅开放图片参考。",
  },
  {
    scene: "对话流视频",
    model: "OpenRouter Kling / Veo",
    rule: getUploadRule({ mode: "video", modelId: "kwaivgi/kling-v3.0-std", transportMode: "local-base64" }),
    note: "Kling 和 Veo 统一保守限制，当前仅开放图片参考。",
  },
  {
    scene: "对话流视频",
    model: "BytePlus Seedance 2.0 系列",
    rule: getUploadRule({ mode: "video", modelId: "byteplus:video.seedance-2-0", transportMode: "server-url" }),
    note: "已完整支持图片、视频、音频参考上传，并按服务器公网 URL 传入模型。",
    details: {
      image: seedanceImageReferenceRuleText,
      video: "视频参考完整规则：mp4/mov；最多 3 个；单个 2-15 秒、≤50MB；总时长≤15秒；宽高比 0.4-2.5；宽高 300-6000px；总像素 409600-2086876。",
      audio: "音频参考完整规则：mp3/wav；最多 3 个；单个 2-15 秒、≤15MB；总时长≤15秒；不能单独输入，必须同时有参考图片或参考视频。",
    },
  },
];

function formatKindRule(rule: UploadKindRule, label: string) {
  if (!rule.enabled) return "不支持";
  const parts = [`最多${rule.maxCount}${label}`];
  if (rule.maxSizeMb > 0) parts.push(`单个≤${rule.maxSizeMb}MB`);
  if (rule.minSeconds !== undefined && rule.maxSeconds !== undefined) parts.push(`${rule.minSeconds}-${rule.maxSeconds}秒`);
  if (rule.maxTotalSeconds !== undefined) parts.push(`总≤${rule.maxTotalSeconds}秒`);
  if (rule.requiresServerUrl) parts.push("需服务器URL");
  parts.push(rule.formats.join("/"));
  return parts.join("，");
}

function UploadRuleCell({ rule, label, detail, incomplete }: { rule: UploadKindRule; label: string; detail?: string; incomplete?: string }) {
  return (
    <div className="break-words px-4 py-3">
      <div>{formatKindRule(rule, label)}</div>
      {detail ? <div className="mt-1 text-[12px] leading-5 text-[#777777]">{detail}</div> : null}
      {incomplete ? <div className="mt-1 text-[12px] leading-5 text-red-500">{incomplete}</div> : null}
    </div>
  );
}

export function AdminUploadRulesPanel() {
  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-[24px] font-semibold tracking-[-0.03em]">上传规则</h1>
        <div className="text-[13px] text-[#777777]">对话流生成和资产库生成共用同一套规则</div>
      </div>

      <section className="min-w-[1180px] overflow-hidden rounded-[10px] border border-[#eeeeee] bg-white text-[13px] shadow-[0_10px_28px_rgba(0,0,0,0.04)]">
        <div className="border-b border-[#eeeeee] bg-[#fafafa] px-5 py-4">
          <div className="text-[15px] font-medium text-[#222222]">上传规则</div>
          <div className="mt-1 text-[12px] leading-5 text-[#888888]">对话流生成和资产库生成共用同一套规则；上传图片和 @资产引用都会计入参考图数量。</div>
        </div>
        <div className="grid grid-cols-[210px_170px_240px_150px_220px_180px] border-b border-[#eeeeee] bg-[#fafafa] text-[12px] font-medium text-[#777777]">
          <div className="px-4 py-3">使用场景</div>
          <div className="px-4 py-3">模型范围</div>
          <div className="px-4 py-3">图片</div>
          <div className="px-4 py-3">文件</div>
          <div className="px-4 py-3">视频</div>
          <div className="px-4 py-3">音频</div>
        </div>
        {uploadRuleRows.map((row) => (
          <div key={`${row.scene}-${row.model}`} className="grid grid-cols-[210px_170px_240px_150px_220px_180px] border-b border-[#f2f2f2] text-[12px] leading-5 text-[#444444] last:border-b-0">
            <div className="px-4 py-3">
              <div className="font-medium text-[#222222]">{row.scene}</div>
              <div className="mt-1 text-[12px] leading-5 text-[#888888]">{row.note}</div>
            </div>
            <div className="break-words px-4 py-3 text-[#333333]">{row.model}</div>
            <UploadRuleCell rule={row.rule.image} label="张" detail={row.details?.image} incomplete={row.incomplete?.image} />
            <UploadRuleCell rule={row.rule.document} label="个" detail={row.details?.document} incomplete={row.incomplete?.document} />
            <UploadRuleCell rule={row.rule.video} label="个" detail={row.details?.video} incomplete={row.incomplete?.video} />
            <UploadRuleCell rule={row.rule.audio} label="个" detail={row.details?.audio} incomplete={row.incomplete?.audio} />
          </div>
        ))}
      </section>
    </>
  );
}
