import { createHederaToolkit } from "./toolkit";

// Provider hook plugged into `createChatHandler`. Reads mode from the parsed
// request body (chat-hedera contributes it via the extension's request-body
// builder; the route hands it back here unchanged) and returns the Hedera
// toolkit. The handler installs per-tool stop conditions for every method in
// `mutatingToolMethods` so a human-mode awaiting-approval payload halts the
// run.
export function getHederaTools(body) {
  const mode = parseMode(body.mode);
  return createHederaToolkit({ mode });
}

export function parseMode(value) {
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
  constructor(message, status) {
    super(message);
    this.status = status;
    this.name = "HederaRequestError";
  }
}
