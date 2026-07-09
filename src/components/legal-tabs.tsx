"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/terms", label: "用户协议" },
  { href: "/privacy", label: "隐私政策" },
];

export function LegalTabs() {
  const pathname = usePathname();
  return (
    <div className="sticky top-0 z-10 bg-white">
      <div className="mx-auto flex max-w-[1000px] items-center gap-7 px-5 sm:px-8">
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`relative py-4 text-[15px] transition ${
                active ? "font-medium text-[#1a1a1a]" : "text-[#8a8a8a] hover:text-[#1a1a1a]"
              }`}
            >
              {tab.label}
              {active ? (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-[#1a1a1a]" />
              ) : null}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
