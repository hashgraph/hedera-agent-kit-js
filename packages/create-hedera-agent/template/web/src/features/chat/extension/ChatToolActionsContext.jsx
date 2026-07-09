"use client";

import * as React from "react";

// Per-chat actions an extension's tool renderer can call into. Substrate-
// defined and generic: nothing here mentions a specific runtime or tool
// family. The substrate populates this once per Chat instance.

const ChatToolActionsContext = React.createContext(null);

export function ChatToolActionsProvider({
  value,
  children,
}) {
  return (
    <ChatToolActionsContext.Provider value={value}>
      {children}
    </ChatToolActionsContext.Provider>
  );
}

export function useChatToolActions() {
  const ctx = React.useContext(ChatToolActionsContext);
  if (!ctx) {
    throw new Error(
      "useChatToolActions must be called inside a <ChatToolActionsProvider>.",
    );
  }
  return ctx;
}
