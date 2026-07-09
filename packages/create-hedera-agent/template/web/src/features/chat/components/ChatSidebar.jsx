"use client";

import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useChatList } from "@/features/chat/hooks/useChatList";

import { ChatSidebarItem } from "./ChatSidebarItem";

export function ChatSidebar({
  activeChatId,
  onActiveChatDeleted,
  onChatCreated,
}) {
  const { entries, createNewChat, deleteWithConfirm } = useChatList({
    activeChatId,
    onActiveChatDeleted,
    onChatCreated,
  });

  return (
    <aside className="bg-card flex w-64 shrink-0 flex-col border-r">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <span className="text-sm font-semibold">Chats</span>
        <Button
          size="sm"
          variant="outline"
          onClick={createNewChat}
          title="Start a new chat"
        >
          <Plus className="size-3.5" /> New
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <ul className="flex flex-col gap-0.5 p-2">
          {entries.length === 0 ? (
            <li className="text-muted-foreground px-2 py-6 text-center text-xs">
              No chats yet. Start one to see it here.
            </li>
          ) : (
            entries.map((entry) => (
              <ChatSidebarItem
                key={entry.id}
                entry={entry}
                isActive={entry.id === activeChatId}
                onDelete={() => deleteWithConfirm(entry.id)}
              />
            ))
          )}
        </ul>
      </ScrollArea>
    </aside>
  );
}
