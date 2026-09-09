import { notFound } from "next/navigation";
import { isLocalProtoTestEnabled } from "@/lib/proto-test-local";
import { ProtoMembershipClient } from "@/app/proto-membership/client";
import type { MembershipTier } from "@/lib/membership";

export const runtime = "nodejs";

export default async function ProtoMembershipPage({ searchParams }: { searchParams?: Promise<{ embed?: string; tier?: string }> }) {
  if (!isLocalProtoTestEnabled()) notFound();
  const params = await searchParams;
  const tier: MembershipTier = params?.tier === "standard" || params?.tier === "pro" ? params.tier : "free";
  return <ProtoMembershipClient tier={tier} embed={params?.embed === "1"} />;
}
