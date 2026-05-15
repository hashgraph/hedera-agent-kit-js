import {
  convertToModelMessages,
  hasToolCall,
  stepCountIs,
  streamText,
  type Tool,
  type UIMessage,
} from "ai";

import { createLLM } from "./llm";

export type ChatHandlerToolset = {
  tools: Record<string, Tool>;
  // Tool method names that mutate server state. The handler installs a
  // per-tool stop condition for each so the streaming run halts the moment a
  // mutating tool produces an awaiting-approval payload (the client then
  // resumes via a separate submit-signed roundtrip).
  mutatingToolMethods: Set<string>;
};

export type ChatHandlerRequestBody = Record<string, unknown> & {
  messages: UIMessage[];
};

export type CreateChatHandlerOptions = {
  // Returns the toolset for a request. Receives the parsed request body so
  // extensions can vary tool wiring by mode, account, or any other key they
  // contribute via the chat-extension request-body aggregator.
  getTools: (body: ChatHandlerRequestBody) => ChatHandlerToolset;
  // Returns the system prompt for a request. Receives the parsed request body
  // for the same reason as `getTools`.
  getSystemPrompt: (body: ChatHandlerRequestBody) => string;
  // Optional validator that runs before the handler dispatches to the LLM.
  // Returning a `Response` short-circuits with that response; returning
  // `undefined` (or omitting the function) lets the request through.
  validateRequest?: (body: ChatHandlerRequestBody) => Response | undefined;
  // Cap on LLM ↔ tool round-trips per request. Defaults to 10 — large enough
  // to chain a few tool calls without risking runaway loops.
  maxSteps?: number;
};

const DEFAULT_MAX_STEPS = 10;

// Factory for the Next.js POST handler that drives the chat agent loop. The
// returned function is the route file's default export wiring; chat-hedera (or
// any other tool extension) supplies the `getTools` / `getSystemPrompt`
// implementations. `chat-runtime/server` itself stays runtime-flavored but
// tool-agnostic.
export function createChatHandler(
  options: CreateChatHandlerOptions,
): (req: Request) => Promise<Response> {
  const {
    getTools,
    getSystemPrompt,
    validateRequest,
    maxSteps = DEFAULT_MAX_STEPS,
  } = options;

  return async function handler(req: Request): Promise<Response> {
    const body = (await req.json()) as ChatHandlerRequestBody;
    if (!Array.isArray(body?.messages)) {
      return jsonError("Missing or invalid `messages` in request body.", 400);
    }
    const rejection = validateRequest?.(body);
    if (rejection) return rejection;

    const toolset = getTools(body);
    const system = getSystemPrompt(body);

    const stopConditions = [
      stepCountIs(maxSteps),
      ...Array.from(toolset.mutatingToolMethods, (method) => hasToolCall(method)),
    ];

    const result = streamText({
      model: createLLM(),
      system,
      messages: await convertToModelMessages(body.messages),
      tools: toolset.tools,
      stopWhen: stopConditions,
    });

    return result.toUIMessageStreamResponse();
  };
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}
