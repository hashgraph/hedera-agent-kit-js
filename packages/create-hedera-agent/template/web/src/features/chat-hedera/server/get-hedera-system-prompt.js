import { HEDERA_NETWORK } from "@/features/chat-hedera/utils/network";
import { readEnv } from "./hedera-client";
import { parseMode } from "./get-hedera-tools";
import { loadSystemPrompt } from "./system-prompt";

// Provider hook plugged into `createChatHandler`. Resolves the operator
// account for the request and renders the system prompt template with those
// variables. Other extensions could append their own prompt fragments via the
// chat-extension `systemPrompt` slot; this provider returns only the
// Hedera-owned contribution.
export function getHederaSystemPrompt(body) {
  const mode = parseMode(body.mode);
  const env = readEnv();
  return loadSystemPrompt({
    operatorId: env.operatorId,
    network: HEDERA_NETWORK,
    mode,
  });
}
