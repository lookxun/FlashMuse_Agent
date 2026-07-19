import type { Metadata } from "next";
import { IS_TEST_SERVER } from "@/lib/app-version";

export const metadata: Metadata = {
  title: `${IS_TEST_SERVER ? "(测试服)" : ""}闪念后台 Management`,
};

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
