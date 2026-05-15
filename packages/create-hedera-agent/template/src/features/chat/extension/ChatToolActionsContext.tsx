"use client";

import * as React from "react";

// Per-chat actions an extension's tool renderer can call into. Substrate-
// defined and generic: nothing here mentions a specific runtime or tool
// family. The substrate populates this once per Chat instance.
export type ChatToolActionsContextValue = {
  // Push a tool-call result into the agent loop. Mirrors the AI SDK's
  // `useChat.addToolResult` but is renamed to keep the context name runtime-
  // agnostic for the eventual `useChatAgent` substrate hook.
  addToolResult: (args: {
    tool: string;
    toolCallId: string;
    output: string;
  }) => Promise<void> | void;
  // Tool method names the server has classified as state-mutating. Extensions
  // use this to decide whether to render a card vs. relying on the timeline
  // row for read-only tools.
  mutatingToolMethods: ReadonlySet<string>;
  // Whether a specific tool call is in a transient, extension-managed pending
  // state (e.g. wallet roundtrip during a HITL approval). The substrate's
  // timeline-row state machine consults this flag to render the row as
  // in-flight rather than awaiting-approval during that window.
  isToolCallPending: (toolCallId: string) => boolean;
  setToolCallPending: (toolCallId: string, pending: boolean) => void;
};

const ChatToolActionsContext =
  React.createContext<ChatToolActionsContextValue | null>(null);

export type ChatToolActionsProviderProps = {
  value: ChatToolActionsContextValue;
  children: React.ReactNode;
};

export function ChatToolActionsProvider({
  value,
  children,
}: ChatToolActionsProviderProps) {
  return (
    <ChatToolActionsContext.Provider value={value}>
      {children}
    </ChatToolActionsContext.Provider>
  );
}

export function useChatToolActions(): ChatToolActionsContextValue {
  const ctx = React.useContext(ChatToolActionsContext);
  if (!ctx) {
    throw new Error(
      "useChatToolActions must be called inside a <ChatToolActionsProvider>.",
    );
  }
  return ctx;
}
