"use client";

import { MembershipModal } from "@/components/membership-modal";
import type { MembershipTier } from "@/lib/membership";

export function ProtoMembershipClient({ tier, embed }: { tier: MembershipTier; embed?: boolean }) {
  return (
    <MembershipModal
      open
      currentTier={tier}
      currentPeriod={tier === "pro" ? "year" : tier === "standard" ? "monthly" : null}
      currentExpiresAt={tier === "free" ? null : "2027-02-26T10:05:00.000Z"}
      currentPaidCny={0}
      nickname="原型测试"
      account="proto@local"
      credits={1500}
      onClose={() => {
        if (embed && window.parent !== window) {
          window.parent.postMessage("close-membership", "*");
          return;
        }
        window.location.href = "/proto-test";
      }}
    />
  );
}
