"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Chat } from "./Chat";
import { ChatHeader } from "./ChatHeader";
import { ChatSidebar } from "./ChatSidebar";
import {
  createChat,
  loadChat,
  onChange,
} from "@/features/chat/state";

// Client-side host for a chat route. It hydrates the chat from localStorage,
// renders the sidebar + chat surface, and handles navigation on new-chat /
// delete-active actions. Co-located with Chat / ChatSidebar to keep all
// browser-only concerns under `components/` rather than the route file.
export function ChatShell({
  chatId,
  mutatingToolMethods,
  headerSlots,
}) {
  const router = useRouter();
  const [state, setState] = React.useState({ status: "loading" });
  // Materialize the server-supplied list once per shell instance so the
  // identity stays stable for downstream memoization and `Set.has` lookups.
  const mutatingToolMethodsSet = React.useMemo(
    () => new Set(mutatingToolMethods),
    [mutatingToolMethods],
  );

  React.useEffect(() => {
    const hydrate = () => {
      const chat = loadChat(chatId);
      setState(chat ? { status: "ready", chat } : { status: "missing" });
    };
    hydrate();
    // Re-hydrate when the active chat is mutated from elsewhere (e.g. the
    // sidebar rename) so the header / title stay accurate.
    return onChange(hydrate);
  }, [chatId]);

  const handleActiveChatDeleted = React.useCallback(() => {
    router.replace("/");
  }, [router]);

  const handleChatCreated = React.useCallback(
    (id) => {
      router.push(`/chat/${encodeURIComponent(id)}`);
    },
    [router],
  );

  // If the chat doesn't exist (deleted in another tab, cleared storage), recover
  // by minting a fresh chat under the same id rather than throwing the user
  // back to root — preserves bookmarkability while keeping the archive clean.
  React.useEffect(() => {
    if (state.status !== "missing") return;
    const chat = createChat({ id: chatId });
    setState({ status: "ready", chat });
  }, [state.status, chatId]);

  return (
    <div className="flex h-dvh">
      <ChatSidebar
        activeChatId={chatId}
        onActiveChatDeleted={handleActiveChatDeleted}
        onChatCreated={handleChatCreated}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        {state.status === "ready" ? (
          <ChatHeader chat={state.chat} slots={headerSlots} />
        ) : (
          <header className="border-b">
            <div className="flex w-full items-center justify-between px-4 py-3">
              <div className="min-w-0 truncate text-sm font-semibold">
                Hedera Agent Chat
              </div>
            </div>
          </header>
        )}
        <main className="flex flex-1 min-h-0 flex-col">
          {state.status === "ready" ? (
            // Re-mount when chatId changes so useChat starts from the new chat's
            // initial messages rather than carrying state across navigation.
            <Chat
              key={state.chat.id}
              chat={state.chat}
              mutatingToolMethods={mutatingToolMethodsSet}
            />
          ) : (
            <div className="text-muted-foreground flex flex-1 items-center justify-center text-sm">
              Loading…
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
