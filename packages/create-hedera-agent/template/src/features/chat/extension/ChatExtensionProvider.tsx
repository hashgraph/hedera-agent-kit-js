"use client";

import * as React from "react";

import { mergeExtensions, type ChatExtensionRegistry } from "./registry";
import type { ChatExtension } from "./types";

const ChatExtensionContext = React.createContext<ChatExtensionRegistry | null>(
  null,
);

export type ChatExtensionProviderProps = {
  extensions: ReadonlyArray<ChatExtension>;
  children: React.ReactNode;
};

export function ChatExtensionProvider({
  extensions,
  children,
}: ChatExtensionProviderProps) {
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

export function useChatExtension(): ChatExtensionRegistry {
  const ctx = React.useContext(ChatExtensionContext);
  if (!ctx) {
    throw new Error(
      "useChatExtension must be called inside a <ChatExtensionProvider>.",
    );
  }
  return ctx;
}
