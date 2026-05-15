// Canonical chat message types. Runtime-neutral by contract: substrate code,
// storage, and extensions consume these without knowing which runtime adapter
// is active. Runtime mappers translate between this shape and the runtime-
// native wire shape inside `features/chat-runtime/`.

export type ChatStatus = "ready" | "submitted" | "streaming" | "error";

export type ChatMessageRole = "user" | "assistant" | "system";

// Text part state matches ai-sdk's text-part states; canonical states are
// a strict superset of the values the substrate observes today.
export type ChatTextPartState = "streaming" | "done";

export type ChatTextPart = {
  type: "text";
  text: string;
  state?: ChatTextPartState;
};

// Tool part state union covers every value the substrate's renderers and
// state machines pattern-match against. Extensions add their own meaning
// to specific values (e.g. chat-hedera maps `output-available` plus an
// AWAITING_APPROVAL envelope to a signing affordance).
export type ChatToolPartState =
  | "input-streaming"
  | "input-available"
  | "output-available"
  | "output-error"
  | "approval-requested"
  | "approval-responded";

// Tool parts carry the runtime-native `type: "tool-${name}"` discriminator
// alongside an explicit `toolName` field so consumers do not have to parse
// the discriminator string. Mappers in chat-runtime preserve both.
export type ChatToolPart = {
  type: `tool-${string}`;
  toolName: string;
  toolCallId: string;
  state: ChatToolPartState;
  input?: unknown;
  output?: unknown;
  errorText?: string;
};

export type ChatMessagePart = ChatTextPart | ChatToolPart;

export type ChatMessage = {
  id: string;
  role: ChatMessageRole;
  parts: ChatMessagePart[];
};

export function isChatToolPart(part: ChatMessagePart): part is ChatToolPart {
  return part.type !== "text";
}
