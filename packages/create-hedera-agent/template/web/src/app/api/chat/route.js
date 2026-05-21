import { createChatHandler } from "@/features/chat-runtime/server";
import {
  getHederaSystemPrompt,
  getHederaTools,
  HederaRequestError,
} from "@/features/chat-hedera/server";
import { createLLM } from "@/features/chat-hedera/server/llm";

export const runtime = "nodejs";
export const maxDuration = 60;

const handler = createChatHandler({
  llm: createLLM(),
  getTools: getHederaTools,
  getSystemPrompt: getHederaSystemPrompt,
});

export async function POST(req) {
  try {
    return await handler(req);
  } catch (err) {
    if (err instanceof HederaRequestError) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: err.status,
        headers: { "content-type": "application/json" },
      });
    }
    throw err;
  }
}
