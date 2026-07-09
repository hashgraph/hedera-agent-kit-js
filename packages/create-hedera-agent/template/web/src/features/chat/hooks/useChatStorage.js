"use client";

import * as React from "react";

import { deriveAutoTitle, saveChat } from "@/features/chat/state";

// Persist messages to localStorage. While streaming, `messages` mutates on
// every token — a synchronous JSON.stringify + setItem of the whole chat per
// token blocks the main thread. Debounce during streaming and flush
// immediately on terminal state so a reload mid-approval stays recoverable.
export function useChatStorage({
  chatId,
  title,
  messages,
  status,
}) {
  const isStreaming = status === "submitted" || status === "streaming";
  React.useEffect(() => {
    if (messages.length === 0) return;
    const flush = () => {
      const autoTitle = deriveAutoTitle(messages);
      const nextTitle = autoTitle && title === "New chat" ? autoTitle : title;
      saveChat({
        id: chatId,
        title: nextTitle,
        updatedAt: Date.now(),
        messages: [...messages],
      });
    };
    if (!isStreaming) {
      flush();
      return;
    }
    const handle = setTimeout(flush, 400);
    return () => clearTimeout(handle);
  }, [messages, chatId, title, isStreaming]);
}
