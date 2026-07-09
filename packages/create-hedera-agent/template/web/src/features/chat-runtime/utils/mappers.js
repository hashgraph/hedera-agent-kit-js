import {
  getToolName,
  isToolUIPart,
} from "ai";

// Mappers between the substrate's canonical chat shapes and ai-sdk's runtime-
// native UIMessage / ChatStatus. Substrate code talks canonical; the runtime
// hook converts on the way in and on the way out. Other runtime adapters
// (LangChain in `runtime-variants/`) supply their own mappers with the same
// inputs and outputs.

export function chatStatusFromAiSdk(status) {
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

export function chatMessagesFromUIMessages(messages) {
  return messages.map(chatMessageFromUIMessage);
}

export function chatMessagesToUIMessages(messages) {
  return messages.map(chatMessageToUIMessage);
}

export function chatMessageFromUIMessage(message) {
  return {
    id: message.id,
    role: message.role,
    parts: message.parts.map(chatPartFromUIPart).filter(isCanonicalPart),
  };
}

export function chatMessageToUIMessage(message) {
  return {
    id: message.id,
    role: message.role,
    parts: message.parts.map(chatPartToUIPart),
  };
}

function chatPartFromUIPart(part) {
  if (part.type === "text") {
    const textPart = {
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
    const toolPart = {
      type: part.type,
      toolName,
      toolCallId: part.toolCallId,
      state: part.state,
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

function chatPartToUIPart(part) {
  if (part.type === "text") {
    const ui = {
      type: "text",
      text: part.text,
    };
    if (part.state) ui.state = part.state;
    return ui;
  }
  const ui = {
    type: part.type,
    toolCallId: part.toolCallId,
    state: part.state,
  };
  if (part.input !== undefined) ui.input = part.input;
  if (part.output !== undefined) ui.output = part.output;
  if (part.errorText !== undefined) ui.errorText = part.errorText;
  return ui;
}

function isCanonicalPart(part) {
  return part !== null;
}
