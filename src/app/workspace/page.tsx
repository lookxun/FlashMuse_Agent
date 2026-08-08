import { AnnouncementBanner } from "@/components/announcement-banner";
import { ChatWorkbenchClient } from "@/components/chat-workbench-client";

export const dynamic = "force-dynamic";

export default function WorkspacePage() {
  return (
    <div className="flashmuse-has-announcement flex h-screen flex-col overflow-hidden bg-[#f5f7fb] text-slate-900">
        <AnnouncementBanner canDismiss />

      <div className="min-h-0 flex-1">
        <ChatWorkbenchClient />
      </div>
    </div>
  );
}
