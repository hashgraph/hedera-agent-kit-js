import { createChatHandler } from "@/features/chat-runtime/server";
import {
  getHederaSystemPrompt,
  getHederaTools,
  HederaRequestError,
} from "@/features/chat-hedera/server";

export const runtime = "nodejs";
export const maxDuration = 60;

// Composition root for the chat API route. The runtime adapter (chat-runtime)
// supplies the agent-loop wiring; the tool extension (chat-hedera) supplies
// the toolset and the system prompt. Neither feature imports the other —
// they meet here.
const handler = createChatHandler({
  getTools: getHederaTools,
  getSystemPrompt: getHederaSystemPrompt,
});

export async function POST(req: Request): Promise<Response> {
  try {
    return await handler(req);
  } catch (err) {
    // Hedera providers throw on missing / invalid `mode`. The runtime adapter
    // stays tool-agnostic, so the route does the translation back to a 4xx.
    if (err instanceof HederaRequestError) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: err.status,
        headers: { "content-type": "application/json" },
      });
    }
    throw err;
  }
}
