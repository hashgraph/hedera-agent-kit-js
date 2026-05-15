"use client";

import * as React from "react";

import {
  Conversation,
  ConversationContent,
} from "@/components/ai-elements/conversation";
import { ChatActivity } from "./ChatActivity";
import { ChatEmptyState } from "./ChatEmptyState";
import { ChatMessage } from "./ChatMessage";
import type { ActivityInput } from "@/features/chat/utils/agent-activity";
import type {
  ChatMessage as ChatMessageModel,
  ChatStatus,
} from "@/features/chat/types";

export type ChatMessageListProps = {
  messages: ReadonlyArray<ChatMessageModel>;
  status: ChatStatus;
  error: Error | undefined;
  pendingToolCallIds: ReadonlySet<string>;
  mutatingToolMethods: ReadonlySet<string>;
  onSelectSuggestion: (prompt: string) => void;
};

export function ChatMessageList({
  messages,
  status,
  error,
  pendingToolCallIds,
  mutatingToolMethods,
  onSelectSuggestion,
}: ChatMessageListProps) {
  const lastIndex = messages.length - 1;
  const showPendingActivity = messages[lastIndex]?.role === "user";

  return (
    <Conversation>
      <ConversationContent>
        {messages.length === 0 ? (
          <ChatEmptyState onSelect={onSelectSuggestion} />
        ) : (
          <>
            {messages.map((message, index) => (
              <ChatMessage
                key={message.id}
                message={message}
                activityInput={buildActivityInput({
                  message,
                  isLastMessage: index === lastIndex,
                  status,
                  error,
                  signingToolCallIds: pendingToolCallIds,
                })}
                mutatingToolMethods={mutatingToolMethods}
              />
            ))}
            {showPendingActivity ? (
              <div className="flex w-full justify-start px-4">
                <ChatActivity input={{ kind: "pending", status }} />
              </div>
            ) : null}
          </>
        )}
      </ConversationContent>
    </Conversation>
  );
}

function buildActivityInput({
  message,
  isLastMessage,
  status,
  error,
  signingToolCallIds,
}: {
  message: ChatMessageModel;
  isLastMessage: boolean;
  status: ChatStatus;
  error: Error | undefined;
  signingToolCallIds: ReadonlySet<string>;
}): ActivityInput | null {
  if (message.role !== "assistant") return null;
  return {
    kind: "message",
    message,
    isLive: isLastMessage,
    status,
    error,
    signingToolCallIds,
  };
}
