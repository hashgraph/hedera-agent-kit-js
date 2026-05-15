import type {
  ChatHandlerRequestBody,
  ChatHandlerToolset,
} from "@/features/chat-runtime/server";

import type { AgentMode } from "@/features/chat-hedera/utils/agent-mode";
import { createHederaToolkit } from "./toolkit";

// Provider hook plugged into `createChatHandler`. Reads mode from the parsed
// request body (chat-hedera contributes it via the extension's request-body
// builder; the route hands it back here unchanged) and returns the Hedera
// toolkit. The handler installs per-tool stop conditions for every method in
// `mutatingToolMethods` so a human-mode awaiting-approval payload halts the
// run.
export function getHederaTools(body: ChatHandlerRequestBody): ChatHandlerToolset {
  const mode = parseMode(body.mode);
  return createHederaToolkit({ mode });
}

export function parseMode(value: unknown): AgentMode {
  if (value === "human" || value === "auto") return value;
  throw new HederaRequestError(
    "Missing or invalid `mode` in request body.",
    400,
  );
}

// Error type the chat route turns into a 4xx response. Thrown from the
// provider so the route can map it without baking validation rules into
// `createChatHandler`.
export class HederaRequestError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "HederaRequestError";
  }
}
