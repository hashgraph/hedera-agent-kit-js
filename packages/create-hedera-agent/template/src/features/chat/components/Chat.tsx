"use client";

import * as React from "react";

import {
  ChatToolActionsProvider,
  useChatExtension,
  type ChatToolActionsContextValue,
} from "@/features/chat/extension";
import { useChatAgent } from "@/features/chat-runtime";
import { ChatComposer, type ChatComposerHandle } from "./ChatComposer";
import { ChatMessageList } from "./ChatMessageList";
import { useChatStorage } from "@/features/chat/hooks/useChatStorage";
import { useToolCallPendingSet } from "@/features/chat/hooks/useToolCallPendingSet";
import type { StoredChat } from "@/features/chat/state";

export type ChatProps = {
  // Stable identifier of the active chat. The page is responsible for picking /
  // minting it; the Chat component just reads/writes the matching localStorage
  // entries. Re-mount via React `key` when this changes so useChat doesn't
  // carry stale state across navigation.
  chat: StoredChat;
  // Method names whose tools mutate server state. Sourced from the runtime's
  // toolkit on the server and threaded down so the substrate can decide card-
  // vs-no-card without duplicating the toolkit's classification.
  mutatingToolMethods: ReadonlySet<string>;
};

export function Chat({ chat, mutatingToolMethods }: ChatProps) {
  const registry = useChatExtension();
  const composerRef = React.useRef<ChatComposerHandle>(null);
  const { pendingToolCallIds, isToolCallPending, setToolCallPending } =
    useToolCallPendingSet();

  // Forward the extensions' merged request-body builder to the runtime hook —
  // chat-hedera contributes `mode` via its `getRequestBody` slot; the substrate
  // never inspects what's inside.
  const { messages, sendMessage, status, stop, error, addToolResult } =
    useChatAgent({
      id: chat.id,
      initialMessages: chat.messages,
      getRequestBody: registry.buildRequestBody,
    });

  useChatStorage({ chatId: chat.id, title: chat.title, messages, status });

  // Substrate-defined tool action surface threaded into every registered
  // extension via `ChatToolActionsContext`. Extensions consume these primitives
  // to build their own tool-call workflows (HITL signing, retries, etc.).
  const toolActions = React.useMemo<ChatToolActionsContextValue>(
    () => ({
      addToolResult,
      mutatingToolMethods,
      isToolCallPending,
      setToolCallPending,
    }),
    [addToolResult, mutatingToolMethods, isToolCallPending, setToolCallPending],
  );

  return (
    <ChatToolActionsProvider value={toolActions}>
      <div className="flex h-full min-h-0 flex-col">
        <ChatMessageList
          messages={messages}
          status={status}
          error={error}
          pendingToolCallIds={pendingToolCallIds}
          mutatingToolMethods={mutatingToolMethods}
          onSelectSuggestion={(prompt) => composerRef.current?.prefill(prompt)}
        />
        <ChatComposer
          ref={composerRef}
          status={status}
          errorMessage={error?.message}
          onSend={(text) => sendMessage({ text })}
          onStop={stop}
        />
      </div>
    </ChatToolActionsProvider>
  );
}
