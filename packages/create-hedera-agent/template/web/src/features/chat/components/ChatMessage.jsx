"use client";

import * as React from "react";

import { Message, MessageContent } from "@/components/ai-elements/message";
import { Response } from "@/components/ai-elements/response";
import { ChatActivity } from "./ChatActivity";
import { ChatToolPart } from "./ChatToolPart";

export function ChatMessage({
  message,
  activityInput,
  mutatingToolMethods,
}) {
  const isAssistant = message.role === "assistant";
  return (
    <Message from={message.role}>
      <MessageContent
        from={message.role}
        className={
          isAssistant ? "w-full max-w-full bg-transparent shadow-none" : undefined
        }
      >
        <div className="flex w-full flex-col gap-3">
          {activityInput ? (
            // Reserve a single-line slot so an activity surface transitioning
            // to `hidden` (e.g. a zero-tool turn where the model answered from
            // context) doesn't yank the reply text upward. The matching `-mt-5`
            // pulls the slot up into the inter-message gap-6 above, so the slot
            // occupies that gap rather than adding to it — the assistant turn
            // ends up at the same vertical offset whether the activity is
            // shown or not, and the visible gap between messages stays compact.
            <div className="-mt-5 min-h-5">
              <ChatActivity
                input={activityInput}
                mutatingToolMethods={mutatingToolMethods}
              />
            </div>
          ) : null}
          {orderToolsFirst(message.parts).map((part, index) => {
            const key = partKey(message.id, part, index);
            if (part.type === "text") {
              return <Response key={key}>{part.text}</Response>;
            }
            return <ChatToolPart key={key} part={part} />;
          })}
        </div>
      </MessageContent>
    </Message>
  );
}

function partKey(messageId, part, index) {
  if (part.type !== "text") {
    return `${messageId}:${part.toolCallId}`;
  }
  return `${messageId}:${index}`;
}

// Cards anchor the top of the assistant message; any reply text streams in
// underneath. The structural element (card with action buttons) stays in a
// stable position while the prose grows, instead of getting pushed around by
// late-arriving text. Stable across re-renders because `Array.prototype.sort`
// is stable on V8.
function orderToolsFirst(parts) {
  return [...parts].sort((a, b) => {
    const aIsText = a.type === "text" ? 1 : 0;
    const bIsText = b.type === "text" ? 1 : 0;
    return aIsText - bIsText;
  });
}
