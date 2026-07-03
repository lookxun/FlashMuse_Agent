"use client";

import dynamic from "next/dynamic";

const ChatWorkbench = dynamic(() => import("@/components/chat-workbench").then((mod) => mod.ChatWorkbench), { ssr: false });

export function ChatWorkbenchClient() {
  return <ChatWorkbench />;
}
