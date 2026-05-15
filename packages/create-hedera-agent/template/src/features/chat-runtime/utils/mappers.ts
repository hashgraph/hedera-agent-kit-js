import {
  getToolName,
  isToolUIPart,
  type ChatStatus as AiSdkChatStatus,
  type UIMessage,
  type UIMessagePart,
  type UIDataTypes,
  type UITools,
} from "ai";

import type {
  ChatMessage,
  ChatMessagePart,
  ChatStatus,
  ChatTextPart,
  ChatToolPart,
} from "@/features/chat/types";

type AnyUIMessagePart = UIMessagePart<UIDataTypes, UITools>;

// Mappers between the substrate's canonical chat shapes and ai-sdk's runtime-
// native UIMessage / ChatStatus. Substrate code talks canonical; the runtime
// hook converts on the way in and on the way out. Other runtime adapters
// (LangChain in `runtime-variants/`) supply their own mappers with the same
// inputs and outputs.

export function chatStatusFromAiSdk(status: AiSdkChatStatus): ChatStatus {
  switch (status) {
    case "ready":
    case "submitted":
    case "streaming":
    case "error":
      return status;
    default:
      // Newer AI SDK versions may introduce additional states. Treat any
      // unknown value as `ready` so substrate UI does not get stuck — the
      // canonical statuses are a stable contract.
      return "ready";
  }
}

export function chatMessagesFromUIMessages(
  messages: ReadonlyArray<UIMessage>,
): ChatMessage[] {
  return messages.map(chatMessageFromUIMessage);
}

export function chatMessagesToUIMessages(
  messages: ReadonlyArray<ChatMessage>,
): UIMessage[] {
  return messages.map(chatMessageToUIMessage);
}

export function chatMessageFromUIMessage(message: UIMessage): ChatMessage {
  return {
    id: message.id,
    role: message.role,
    parts: message.parts.map(chatPartFromUIPart).filter(isCanonicalPart),
  };
}

export function chatMessageToUIMessage(message: ChatMessage): UIMessage {
  return {
    id: message.id,
    role: message.role,
    parts: message.parts.map(chatPartToUIPart),
  } as UIMessage;
}

function chatPartFromUIPart(part: AnyUIMessagePart): ChatMessagePart | null {
  if (part.type === "text") {
    const textPart: ChatTextPart = {
      type: "text",
      text: part.text,
    };
    if (part.state === "streaming" || part.state === "done") {
      textPart.state = part.state;
    }
    return textPart;
  }
  if (isToolUIPart(part)) {
    const toolName = getToolName(part);
    const toolPart: ChatToolPart = {
      type: part.type as `tool-${string}`,
      toolName,
      toolCallId: part.toolCallId,
      state: part.state as ChatToolPart["state"],
    };
    if ("input" in part) toolPart.input = part.input;
    if (part.state === "output-available" && "output" in part) {
      toolPart.output = part.output;
    }
    if (part.state === "output-error" && "errorText" in part) {
      toolPart.errorText = part.errorText;
    }
    return toolPart;
  }
  // Drop unknown parts (e.g. step boundary markers) from the canonical view.
  // Substrate code never inspects them; the runtime adapter would not surface
  // them to chat-runtime callers either.
  return null;
}

function chatPartToUIPart(part: ChatMessagePart): AnyUIMessagePart {
  if (part.type === "text") {
    const ui: { type: "text"; text: string; state?: "streaming" | "done" } = {
      type: "text",
      text: part.text,
    };
    if (part.state) ui.state = part.state;
    return ui as AnyUIMessagePart;
  }
  const ui: Record<string, unknown> = {
    type: part.type,
    toolCallId: part.toolCallId,
    state: part.state,
  };
  if (part.input !== undefined) ui.input = part.input;
  if (part.output !== undefined) ui.output = part.output;
  if (part.errorText !== undefined) ui.errorText = part.errorText;
  return ui as unknown as AnyUIMessagePart;
}

function isCanonicalPart(part: ChatMessagePart | null): part is ChatMessagePart {
  return part !== null;
}
