"use client";

import * as React from "react";

import {
  Conversation,
  ConversationContent,
} from "@/components/ai-elements/conversation";
import { ChatActivity } from "./ChatActivity";
import { ChatEmptyState } from "./ChatEmptyState";
import { ChatMessage } from "./ChatMessage";

export function ChatMessageList({
  messages,
  status,
  error,
  pendingToolCallIds,
  mutatingToolMethods,
  onSelectSuggestion,
}) {
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
}) {
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
