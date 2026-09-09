import { resolveImageSettingsForModel, resolveVideoSettingsForModel } from "@/lib/models";
import {
  MEMBERSHIP_CONCURRENCY_DENIED_MESSAGE,
  MEMBERSHIP_MODEL_DENIED_MESSAGE,
  MEMBERSHIP_RESOLUTION_DENIED_MESSAGE,
  canMembershipUseImageModel,
  canMembershipUseImageResolution,
  canMembershipUseVideoModel,
  canMembershipUseVideoResolution,
  MEMBERSHIP_SYSTEM_ENABLED,
  getActiveMembershipTier,
  type MembershipSettings,
  type MembershipTier,
} from "@/lib/membership";

export function getUserMembershipTier(user?: { membershipTier?: string | null; membershipExpiresAt?: Date | string | null } | null | Record<string, unknown>): MembershipTier {
  return getActiveMembershipTier(user);
}

export function isMembershipDeniedError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  return message === MEMBERSHIP_MODEL_DENIED_MESSAGE || message === MEMBERSHIP_RESOLUTION_DENIED_MESSAGE || message === MEMBERSHIP_CONCURRENCY_DENIED_MESSAGE;
}

/* ⛔⛔ 铁律（2026-08-30 审计抓到的真实绕过，别改回去）：
 * **必须校验「归一化之后真正会用的分辨率」，不能校验客户端请求的那个值。**
 * 模型规则表会把自己不支持的档位**抬到该模型的默认档**（`resolveXxxSettingsForModel`），
 * 所以「请求 720p / 干脆不传」在只有高档位的模型上会变成高档位：
 *   - `minimax/hailuo-3` 只有 2K → 传 720p 或不传都变 **2K**（基础会员只允许 720p）；
 *   - `kwaivgi/kling-video-o1` 只有 1080p → 传 720p 变 **1080p**（标准会员只允许 720p）。
 * 只校验请求值 = 等于没校验，用户直接拿到付费档画质（而且 2K 视频最贵）。
 * ⭐ 判据：拿 `resolveVideoSettingsForModel(model, settings).resolution` 去比，不是拿 `settings.resolution`。
 */
export function shouldEnforceMembershipGenerationLimit(input: { creditSource?: string; editFunction?: boolean; referenceMode?: string }) {
  if (!MEMBERSHIP_SYSTEM_ENABLED) return false;
  if (input.editFunction) return false;
  if (input.referenceMode === "edit" || input.referenceMode === "extend") return false;
  const source = input.creditSource ?? "";
  if (!source || source === "conversation") return true;
  if (source === "workflow_image_generation" || source === "workflow_video_generation") return true;
  if (source.startsWith("character_") || source.startsWith("scene_") || source.startsWith("prop_") || source.startsWith("shot_")) return true;
  if (source.includes("asset") && source.includes("image")) return true;
  return false;
}

export function assertMembershipImageAllowed(tier: MembershipTier, model?: string, resolution?: string, settings?: MembershipSettings, ratio?: string) {
  if (!canMembershipUseImageModel(tier, model, settings)) throw new Error(MEMBERSHIP_MODEL_DENIED_MESSAGE);
  const effective = model ? resolveImageSettingsForModel(model, { ratio, resolution }).resolution : resolution;
  if (!canMembershipUseImageResolution(tier, effective, settings)) throw new Error(MEMBERSHIP_RESOLUTION_DENIED_MESSAGE);
}

export function assertMembershipVideoAllowed(tier: MembershipTier, model?: string, resolution?: string, settings?: MembershipSettings, ratio?: string) {
  if (!canMembershipUseVideoModel(tier, model, settings)) throw new Error(MEMBERSHIP_MODEL_DENIED_MESSAGE);
  const effective = model ? resolveVideoSettingsForModel(model, { ratio, resolution }).resolution : resolution;
  if (!canMembershipUseVideoResolution(tier, effective, settings)) throw new Error(MEMBERSHIP_RESOLUTION_DENIED_MESSAGE);
}

/* ⛔⛔ 这里原来有个 `assertMembershipConcurrencyAllowed(userId, tier, settings)`：
 *   「先 count 在跑的任务，再放行」。它是 TOCTOU —— 20 个请求同时进来都 count 到 0
 *   → 全部放行 → 基础会员「同时生成 1 条」形同虚设（2026-08-30 审计抓到）。
 *   已被 `lib/generation-quota.ts` 的 `reserveGenerationQuota` 取代
 *   （同一事务里加 per-user 咨询锁 + 插占位，顺带把「积分够不够」一起原子判掉）。
 *   ⛔ 别把那个函数捡回来。
 */
