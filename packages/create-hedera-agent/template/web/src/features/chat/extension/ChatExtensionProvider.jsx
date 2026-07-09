"use client";

import * as React from "react";

import { mergeExtensions } from "./registry";

const ChatExtensionContext = React.createContext(null);

export function ChatExtensionProvider({
  extensions,
  children,
}) {
  const registry = React.useMemo(
    () => mergeExtensions(extensions),
    [extensions],
  );
  return (
    <ChatExtensionContext.Provider value={registry}>
      {children}
    </ChatExtensionContext.Provider>
  );
}

export function useChatExtension() {
  const ctx = React.useContext(ChatExtensionContext);
  if (!ctx) {
    throw new Error(
      "useChatExtension must be called inside a <ChatExtensionProvider>.",
    );
  }
  return ctx;
}
