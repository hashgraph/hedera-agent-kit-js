"use client";

import * as React from "react";

export function ChatHeader({ chat, slots }) {
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
