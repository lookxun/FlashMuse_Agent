import { ChatWorkbench } from "@/components/chat-workbench";

export default function WorkspacePage() {
  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <main className="flex min-h-screen w-full flex-col">
        <div className="flex-1">
          <ChatWorkbench />
        </div>
      </main>
    </div>
  );
}
