import {
  convertToModelMessages,
  hasToolCall,
  stepCountIs,
  streamText,
} from "ai";

const DEFAULT_MAX_STEPS = 10;

// Factory for the Next.js POST handler that drives the chat agent loop. The
// returned function is the route file's default export wiring; chat-hedera (or
// any other tool extension) supplies the `getTools` / `getSystemPrompt`
// implementations. `chat-runtime/server` itself stays runtime-flavored but
// tool-agnostic.
export function createChatHandler(options) {
  const {
    llm,
    getTools,
    getSystemPrompt,
    validateRequest,
    maxSteps = DEFAULT_MAX_STEPS,
  } = options;

  return async function handler(req) {
    const body = await req.json();
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
      model: llm,
      system,
      messages: await convertToModelMessages(body.messages),
      tools: toolset.tools,
      stopWhen: stopConditions,
    });

    return result.toUIMessageStreamResponse();
  };
}

function jsonError(message, status) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}
