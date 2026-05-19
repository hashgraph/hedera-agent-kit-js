"use client";

import * as React from "react";

import {
  createChat,
  deleteChat,
  loadChatIndex,
  onChange,
} from "@/features/chat/state";

// Owns the sidebar's chat-list state: hydrates from localStorage after mount
// (so SSR never reads `window`), subscribes to in-tab CRUD notifications and
// cross-tab `storage` events so the list stays fresh, and wraps create/delete
// with the page-level navigation callbacks.
export function useChatList({
  activeChatId,
  onActiveChatDeleted,
  onChatCreated,
}) {
  const [entries, setEntries] = React.useState([]);

  React.useEffect(() => {
    const refresh = () => setEntries(loadChatIndex());
    refresh();
    const off = onChange(refresh);
    const handleStorage = (event) => {
      if (!event.key) {
        refresh();
        return;
      }
      if (
        event.key === "hedera-chats:index" ||
        event.key.startsWith("hedera-chat:")
      ) {
        refresh();
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => {
      off();
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const createNewChat = React.useCallback(() => {
    const chat = createChat();
    onChatCreated(chat.id);
  }, [onChatCreated]);

  const deleteWithConfirm = React.useCallback(
    (id) => {
      if (typeof window === "undefined") return;
      // Native confirm keeps the scaffold dependency-light. Swap for a styled
      // dialog if a future slice introduces shadcn Dialog.
      const ok = window.confirm("Delete this chat? This cannot be undone.");
      if (!ok) return;
      deleteChat(id);
      if (activeChatId === id) {
        onActiveChatDeleted();
      }
    },
    [activeChatId, onActiveChatDeleted],
  );

  return { entries, createNewChat, deleteWithConfirm };
}
