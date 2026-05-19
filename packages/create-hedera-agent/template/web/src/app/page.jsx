"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { createChat } from "@/features/chat/state";

// Bare `/` always mints a fresh chat and redirects to `/chat/<id>` — the PRD's
// "new-chat flow is deterministic". Every chat lives at a stable, bookmarkable
// URL; users return to existing chats via the sidebar, not via `/`.
export default function Home() {
  const router = useRouter();

  React.useEffect(() => {
    const chat = createChat();
    router.replace(`/chat/${encodeURIComponent(chat.id)}`);
  }, [router]);

  return (
    <div className="text-muted-foreground flex h-dvh items-center justify-center text-sm">
      Loading…
    </div>
  );
}
