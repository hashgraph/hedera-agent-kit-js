"use client";

import * as React from "react";

import type { StoredChat } from "@/features/chat/state";

export type ChatHeaderProps = {
  chat: StoredChat;
  // Right-aligned slot for app-composed controls (mode toggle, wallet button,
  // etc.). The substrate has no knowledge of what's rendered here; the app
  // assembles the JSX from each feature's directory and passes it down.
  slots?: React.ReactNode;
};

export function ChatHeader({ chat, slots }: ChatHeaderProps) {
  return (
    <header className="border-b">
      <div className="flex w-full items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0 truncate text-sm font-semibold">
          {chat.title}
        </div>
        {slots ? (
          <div className="flex items-center gap-2">{slots}</div>
        ) : null}
      </div>
    </header>
  );
}
