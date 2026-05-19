"use client";

import * as React from "react";

import {
  ChatToolActionsProvider,
  useChatExtension,
} from "@/features/chat/extension";
import { useChatAgent } from "@/features/chat-runtime";
import { ChatComposer } from "./ChatComposer";
import { ChatMessageList } from "./ChatMessageList";
import { useChatStorage } from "@/features/chat/hooks/useChatStorage";
import { useToolCallPendingSet } from "@/features/chat/hooks/useToolCallPendingSet";

export function Chat({ chat, mutatingToolMethods }) {
  const registry = useChatExtension();
  const composerRef = React.useRef(null);
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
  const toolActions = React.useMemo(
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
