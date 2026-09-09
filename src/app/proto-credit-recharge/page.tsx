import { notFound } from "next/navigation";
import { isLocalProtoTestEnabled } from "@/lib/proto-test-local";
import { ProtoCreditRechargeClient } from "@/app/proto-credit-recharge/client";

export const runtime = "nodejs";

type Scenario = "pending" | "paid" | "closed" | "order-fail";

export default async function ProtoCreditRechargePage({ searchParams }: { searchParams?: Promise<{ embed?: string; scenario?: string }> }) {
  if (!isLocalProtoTestEnabled()) notFound();
  const params = await searchParams;
  const raw = params?.scenario;
  const scenario: Scenario = raw === "paid" || raw === "closed" || raw === "order-fail" ? raw : "pending";
  return <ProtoCreditRechargeClient scenario={scenario} embed={params?.embed === "1"} />;
}
