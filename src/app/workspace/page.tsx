import { ChatWorkbenchClient } from "@/components/chat-workbench-client";

export const dynamic = "force-dynamic";

export default function WorkspacePage() {
  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <main className="flex min-h-screen w-full flex-col">
        <div className="flex-1">
          <ChatWorkbenchClient />
        </div>
      </main>
    </div>
  );
}
