import { createElement, type SVGProps } from "react";
import { RiGoogleFill, RiOpenaiFill, RiTiktokFill } from "react-icons/ri";
import { BytePlusIcon } from "@/components/byteplus-icon";
import { KlingIcon } from "@/components/kling-icon";
import { MiniMaxIcon } from "@/components/minimax-icon";
import { GrokIcon } from "@/components/grok-icon";
import { KimiIcon } from "@/components/kimi-icon";
import { RecraftIcon } from "@/components/recraft-icon";
import { QwenIcon } from "@/components/qwen-icon";
import { FishAudioIcon } from "@/components/fish-audio-icon";

/**
 * 「模型 → 图标」的**唯一权威**（前台对话流 / 工作流画布 / 后台各面板共用）。
 *
 * ⛔⛔ 2026-08-09 收敛：这套东西原来存在**三份**、而且已经漂移：
 *   - `chat/chat-workbench-core.tsx` 那份最全；
 *   - `workflow-tldraw-canvas-inner.tsx` 那份**漏了 DeepSeek**；
 *   - `admin/admin-system-settings-panel.tsx` 那份**漏了 MiniMax 和 Kling**（可灵/海螺模型只能显示兜底图标）。
 * 以后新增供应商**只改这里一处**，三边自动一致。⛔ 禁止再在别处写 `modelId.startsWith("xxx/")` 判图标。
 */

function AiGenerate3dIconSvg({ className = "h-[18px] w-[18px] shrink-0 text-[#777777]", ...props }: SVGProps<SVGSVGElement> & { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className} {...props}>
      <path d="M15.1416 2.81836L13.1016 3.94824L12 3.31055L4.5 7.65234V7.6582L12 12V20.6895L19.5 16.3467V11.5L21.5 10.3291V17.5L12 23L2.5 17.5V6.5L12 1L15.1416 2.81836ZM18.5293 2.31934C18.7059 1.8935 19.2943 1.89349 19.4707 2.31934L19.7236 2.93066C20.1556 3.97346 20.9615 4.80618 21.9746 5.25684L22.6924 5.57617C23.1026 5.75901 23.1026 6.3562 22.6924 6.53906L21.9326 6.87695C20.9449 7.31624 20.1534 8.11944 19.7139 9.12793L19.4668 9.69336C19.2864 10.1075 18.7137 10.1075 18.5332 9.69336L18.2871 9.12793C17.8476 8.11929 17.0552 7.31628 16.0674 6.87695L15.3076 6.53906C14.8974 6.35622 14.8974 5.75899 15.3076 5.57617L16.0254 5.25684C17.0385 4.80618 17.8445 3.97348 18.2764 2.93066L18.5293 2.31934Z" />
    </svg>
  );
}

/** 没有匹配到供应商时的兜底图标。 */
export const AiGenerate3dIcon = AiGenerate3dIconSvg;

/**
 * Agent / 通用模式那个"小人+星"图标。原来只在 chat-workbench-core 里当私有组件，
 * 2026-08-09 搬到这里成为唯一实现（后台「上传规则」表的"全部对话模型"那行也要用它）。
 */
export function AiAgentLineIcon({ className = "h-4 w-4", ...props }: SVGProps<SVGSVGElement> & { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className} {...props}>
      <path d="M12 2C17.5228 2 22 6.47715 22 12C22 14.7096 20.9205 17.1697 19.1709 18.9697C17.3551 20.8376 14.8124 22 12 22C9.18756 22 6.64488 20.8376 4.8291 18.9697C3.07949 17.1697 2 14.7096 2 12C2 6.47715 6.47715 2 12 2ZM12 16C10.0022 16 8.20124 16.8375 6.9248 18.1816C8.30642 19.3175 10.0724 20 12 20C13.9274 20 15.6927 19.3173 17.0742 18.1816C15.7978 16.8377 13.9975 16 12 16ZM12 4C7.58172 4 4 7.58172 4 12C4 13.7701 4.57462 15.4044 5.54785 16.7295C7.1822 15.0483 9.46797 14 12 14C14.5318 14 16.8169 15.0485 18.4512 16.7295C19.4246 15.4043 20 13.7703 20 12C20 7.58172 16.4183 4 12 4ZM11.5293 5.31934C11.7058 4.89329 12.2943 4.89329 12.4707 5.31934L12.7236 5.93066C13.1556 6.97343 13.9615 7.80622 14.9746 8.25684L15.6924 8.5752C16.1029 8.75796 16.1028 9.35627 15.6924 9.53906L14.9326 9.87695C13.9448 10.3163 13.1534 11.1193 12.7139 12.1279L12.4668 12.6934C12.2864 13.1074 11.7137 13.1074 11.5332 12.6934L11.2871 12.1279C10.8476 11.1193 10.0552 10.3163 9.06738 9.87695L8.30762 9.53906C7.89719 9.35628 7.89717 8.75795 8.30762 8.5752L9.02539 8.25684C10.0385 7.80623 10.8445 6.97345 11.2764 5.93066L11.5293 5.31934Z" />
    </svg>
  );
}

export function DeepSeekIcon({ className = "h-4 w-4", ...props }: SVGProps<SVGSVGElement> & { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className} {...props}>
      <path d="M19.7486 6.70266C20.3482 6.09168 21.0251 5.88487 21.8216 5.88487 22.4994 5.88487 22.8772 5.51788 23.1687 5.23481 23.3841 5.0256 23.5423 4.86223 23.7495 4.9267 23.9849 4.99995 24.0039 5.27202 23.9849 5.49211 23.8092 7.48319 22.5352 9.10375 20.5089 9.33432 20.3217 9.35326 20.2848 9.41777 20.2886 9.58097 20.2886 12.135 19.3023 14.3682 17.7413 16.3177 17.3773 16.7723 17.4617 17.397 18.0099 17.5934 18.2913 17.6942 18.6306 17.8197 19.0629 18.0261 19.3173 18.1475 19.3664 18.8022 18.6619 18.952 18.2141 19.0446 17.728 19.1012 17.2409 19.0989 16.0407 19.0932 14.7567 19.2619 13.6741 19.7802 12.5444 20.3211 11.5023 20.4276 10.5351 20.4832 6.05234 20.7487 1.91959 17.3891 1.14577 12.9829.4786 9.18832 2.57147 5.07162 6.66325 4.61173 7.14737 4.55719 7.62089 4.53981 8.0848 4.55739 8.87454 4.58733 9.6213 4.41281 10.366 4.23877 11.0506 4.07878 11.7335 3.9192 12.4464 3.9192 13.289 3.9192 13.4518 4.23796 13.1926 4.33093 12.9459 4.42011 12.0002 5.5 12.8219 6.09927 13.5751 6.5753 14.217 7.22865 14.859 7.88213 15.7004 8.73861 16.542 9.59533 17.6349 10.0534 17.8183 10.1293 17.8968 10.0914 17.9488 9.91865 17.984 9.80487 18.021 9.69242 18.0579 9.58018 18.1084 9.42668 18.1588 9.27358 18.2041 9.11798 18.2458 8.98703 18.2118 8.896 18.0803 8.80682 16.5019 7.7348 15.7807 5.49544 16.7241 3.7693 16.9257 3.40591 17.2152 3.45676 17.3454 3.8414 17.5002 4.5 17.6793 4.81997 18.5532 5.2113 19.1972 5.4997 19.6209 5.94937 19.7486 6.70266ZM12.2889 8.15848C10.7532 7.02012 8.79874 6.38384 6.88727 6.59919 5.50456 6.7546 4.48708 7.51265 3.84434 8.54596 4.06732 8.56243 4.31508 8.58934 4.58987 8.62966 6.85894 8.96265 8.79097 9.98777 10.3898 11.5802 11.3587 12.5454 12.1238 13.6898 12.8253 14.6671 13.4051 15.4748 13.9559 16.1921 14.5951 16.7793 15.8396 15.7081 16.6794 14.4169 17.0503 13.8 17.8977 12.3908 17.6928 12.2942 16.853 11.898 16.316 11.6446 15.5193 11.2687 14.5722 10.3488 13.5602 9.36588 13.0771 8.7451 12.2889 8.15848ZM3.11574 12.637C3.70717 16 6.70788 18.473 10.417 18.4867 11.3223 18.4901 12.1492 18.2666 12.8906 17.9119 12.2402 17.2517 11.6978 16.526 11.2006 15.8333 10.4412 14.7753 9.79818 13.8139 8.97846 12.9972 7.66251 11.6866 6.11607 10.8751 4.29954 10.6085 3.72541 10.5242 3.34242 10.5175 3.11076 10.5295 2.99297 11.2236 2.99407 11.9452 3.11574 12.637ZM15.1938 11.1427C14.7189 10.6785 13.9006 9.95702 13.1369 10.3762 12.0002 11 14.354 13.4813 15.472 13.4291 17.254 13.3458 15.7214 11.7533 15.1938 11.1427Z" />
    </svg>
  );
}

/**
 * 按模型 id 取图标组件；匹配不到返回 null（调用方自己决定兜底，通常用 AiGenerate3dIcon）。
 * ⭐ 判定顺序不要随便调：`byteplus:` / `ep-` 必须在 `bytedance` 之前，
 *   否则我们自己的 BytePlus 端点会被当成 OpenRouter 的 bytedance 模型。
 */
export function getGenerationModelIcon(modelId: string) {
  if (modelId.startsWith("deepseek/")) return DeepSeekIcon;
  if (modelId.startsWith("byteplus:") || modelId.startsWith("byteplus/") || modelId.startsWith("ep-")) return BytePlusIcon;
  if (modelId.startsWith("openai/")) return RiOpenaiFill;
  if (modelId.startsWith("google/")) return RiGoogleFill;
  if (modelId.startsWith("bytedance/") || modelId.startsWith("bytedance-seed/")) return RiTiktokFill;
  if (modelId.startsWith("minimax/")) return MiniMaxIcon;
  if (modelId.startsWith("moonshotai/")) return KimiIcon;
  if (modelId.startsWith("x-ai/")) return GrokIcon;
  if (modelId.startsWith("qwen/")) return QwenIcon;
  if (modelId.startsWith("fish-audio/")) return FishAudioIcon;
  if (modelId.startsWith("kwaivgi/")) return KlingIcon;
  if (modelId.startsWith("recraft/")) return RecraftIcon;
  return null;
}

/**
 * 直接渲染版（带兜底）——后台各表格里就要这个，省去每处写一遍三元。
 * 默认样式沿用后台的 16px 灰色；画布/对话流那边尺寸不同，自己传 className。
 *
 * ⭐ 用 `createElement` 而不是 `const Icon = ...; <Icon />`：后者会被
 *   eslint 的 `react-hooks/static-components` 判成"渲染期创建组件"（虽然这里是查表拿到的
 *   稳定引用、不会真的丢状态，但没必要留一条新的 lint 错误）。⛔ 别改回 JSX 变量写法。
 */
export function ModelIcon({ modelId, className = "h-4 w-4 shrink-0 text-[#555555]" }: { modelId: string; className?: string }) {
  return createElement(getGenerationModelIcon(modelId) ?? AiGenerate3dIcon, { className, "aria-hidden": true });
}
