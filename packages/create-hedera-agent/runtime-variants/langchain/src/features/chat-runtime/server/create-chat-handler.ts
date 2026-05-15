import {
  AIMessage,
  AIMessageChunk,
  ToolMessage,
  type BaseMessage,
} from "@langchain/core/messages";
import type { StructuredToolInterface } from "@langchain/core/tools";
import { createAgent } from "langchain";
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  type UIMessage,
  type UIMessageStreamWriter,
} from "ai";

import { chatMessagesFromUIMessages } from "../utils/mappers";
import { createLLM } from "./llm";
import { chatMessagesToBaseMessages } from "./messages";

// Status the langchain toolkit emits when a mutating tool runs in human mode
// and produces an awaiting-approval payload. The handler watches for this on
// every ToolMessage so it can halt the agent before the LLM burns another step
// reasoning about a placeholder result.
export const AWAITING_APPROVAL_STATUS = "AWAITING_APPROVAL";

export type ChatHandlerToolset = {
  // LangChain agents take an array of structured tools, not a Record.
  tools: StructuredToolInterface[];
  // Tool method names that mutate server state. Used as a defense in depth — the
  // langchain toolkit already wraps mutating tools to return AWAITING_APPROVAL,
  // and the stream loop honours that envelope explicitly.
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
  // Optional validator that runs before the handler dispatches to the agent.
  // Returning a `Response` short-circuits with that response; returning
  // `undefined` (or omitting the function) lets the request through.
  validateRequest?: (body: ChatHandlerRequestBody) => Response | undefined;
  // Cap on LangGraph node visits per request. Defaults to 25 — large enough to
  // chain a few tool calls without risking runaway loops.
  maxRecursion?: number;
};

const DEFAULT_MAX_RECURSION = 25;

// Factory for the Next.js POST handler that drives the langchain agent loop.
// The returned function is the route file's wiring; chat-hedera (or any other
// tool extension) supplies the `getTools` / `getSystemPrompt` implementations.
// The handler adapts langchain's heterogeneous event stream to the ai-sdk
// UIMessage stream protocol the client expects.
export function createChatHandler(
  options: CreateChatHandlerOptions,
): (req: Request) => Promise<Response> {
  const {
    getTools,
    getSystemPrompt,
    validateRequest,
    maxRecursion = DEFAULT_MAX_RECURSION,
  } = options;

  return async function handler(req: Request): Promise<Response> {
    const body = (await req.json()) as ChatHandlerRequestBody;
    if (!Array.isArray(body?.messages)) {
      return jsonError("Missing or invalid `messages` in request body.", 400);
    }
    const rejection = validateRequest?.(body);
    if (rejection) return rejection;

    const toolset = getTools(body);
    const systemPrompt = getSystemPrompt(body);

    const baseMessages = chatMessagesToBaseMessages(
      chatMessagesFromUIMessages(body.messages),
    );

    const llm = createLLM();
    const agent = createAgent({
      model: llm,
      tools: toolset.tools,
      systemPrompt,
    });

    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        await streamLangchainAgentToUI({
          agent,
          baseMessages,
          writer,
          maxRecursion,
        });
      },
      onError: (error) =>
        error instanceof Error ? error.message : "Unknown agent error",
    });

    return createUIMessageStreamResponse({ stream });
  };
}

type StreamAdapterArgs = {
  agent: ReturnType<typeof createAgent>;
  baseMessages: BaseMessage[];
  writer: UIMessageStreamWriter;
  maxRecursion: number;
};

// The LangChain ReactAgent emits a heterogeneous stream of LangGraph state
// updates and message deltas. We translate that into the AI SDK UIMessage
// protocol the client expects:
//   • AIMessageChunk text → text-start / text-delta / text-end
//   • AIMessageChunk tool_call_chunks → tool-input-start / tool-input-delta
//   • completed AIMessage with tool_calls → tool-input-available
//   • ToolMessage results → tool-output-available
// When a tool result carries an AWAITING_APPROVAL status (human-mode mutating
// tool), we emit it, abort the agent, and finish the stream — the client takes
// over via the submit-signed endpoint and resumes via `addToolResult`.
async function streamLangchainAgentToUI({
  agent,
  baseMessages,
  writer,
  maxRecursion,
}: StreamAdapterArgs): Promise<void> {
  const abortController = new AbortController();
  const messageId = `msg-${randomId()}`;
  let textPartId: string | null = null;
  const emittedToolCallIds = new Set<string>();
  const emittedToolResultIds = new Set<string>();
  // Tracks which tool calls have had their `tool-input-start` emitted from the
  // chunk-level stream, so we don't re-announce them when the same id is later
  // seen in updates mode. Independent of `emittedToolCallIds`, which gates the
  // `tool-input-available` close-out.
  const startedToolCallIds = new Set<string>();
  // Streaming tool_call_chunks identify themselves by `index`; the `id` and
  // `name` may only land on the first chunk of that index, with subsequent
  // chunks carrying argument deltas alone. We buffer the resolved id/name per
  // index so later args-only chunks can look up their toolCallId.
  const toolChunkMetaByIndex = new Map<number, { id?: string; name?: string }>();
  let awaitingApproval = false;

  writer.write({ type: "start", messageId });
  writer.write({ type: "start-step" });

  const closeTextPart = () => {
    if (textPartId) {
      writer.write({ type: "text-end", id: textPartId });
      textPartId = null;
    }
  };

  try {
    const eventStream = await agent.stream(
      { messages: baseMessages },
      {
        streamMode: ["messages", "updates"],
        recursionLimit: maxRecursion,
        signal: abortController.signal,
      },
    );

    for await (const event of eventStream) {
      const [eventMode, payload] = event as ["messages" | "updates", unknown];

      if (eventMode === "messages") {
        const [chunk] = payload as [BaseMessage, Record<string, unknown>];
        if (!AIMessageChunk.isInstance(chunk)) continue;

        const textDelta = toTextString(chunk.content);
        if (textDelta) {
          if (!textPartId) {
            textPartId = `txt-${randomId()}`;
            writer.write({ type: "text-start", id: textPartId });
          }
          writer.write({ type: "text-delta", id: textPartId, delta: textDelta });
        }

        const toolCallChunks = chunk.tool_call_chunks;
        if (toolCallChunks && toolCallChunks.length > 0) {
          for (const tcc of toolCallChunks) {
            const index = tcc.index ?? 0;
            const meta = toolChunkMetaByIndex.get(index) ?? {};
            if (tcc.id) meta.id = tcc.id;
            if (tcc.name) meta.name = tcc.name;
            toolChunkMetaByIndex.set(index, meta);

            // Announce the tool call the moment we have both an id and a name
            // so the client transitions the new tool part into `input-streaming`
            // and the activity-state-derivation module picks up the per-tool
            // label. Without it the part skips straight to `input-available`
            // and the label only appears after the full AIMessage finalizes.
            if (meta.id && meta.name && !startedToolCallIds.has(meta.id)) {
              closeTextPart();
              writer.write({
                type: "tool-input-start",
                toolCallId: meta.id,
                toolName: meta.name,
              });
              startedToolCallIds.add(meta.id);
            }

            if (
              meta.id &&
              startedToolCallIds.has(meta.id) &&
              typeof tcc.args === "string" &&
              tcc.args.length > 0
            ) {
              writer.write({
                type: "tool-input-delta",
                toolCallId: meta.id,
                inputTextDelta: tcc.args,
              });
            }
          }
        }

        continue;
      }

      if (eventMode === "updates") {
        const nodes = payload as Record<string, { messages?: BaseMessage[] } | undefined>;
        for (const nodeValue of Object.values(nodes)) {
          const nodeMessages = nodeValue?.messages;
          if (!Array.isArray(nodeMessages)) continue;
          for (const message of nodeMessages) {
            if (
              AIMessage.isInstance(message) &&
              Array.isArray(message.tool_calls) &&
              message.tool_calls.length > 0
            ) {
              // The model finished a tool-calling turn. Close any open text part
              // before announcing tools so the UI orders text → cards correctly.
              closeTextPart();
              for (const call of message.tool_calls) {
                const id = call.id;
                if (!id || emittedToolCallIds.has(id)) continue;
                emittedToolCallIds.add(id);
                writer.write({
                  type: "tool-input-available",
                  toolCallId: id,
                  toolName: call.name,
                  input: call.args ?? {},
                });
              }
            } else if (ToolMessage.isInstance(message)) {
              const id = message.tool_call_id;
              if (emittedToolResultIds.has(id)) continue;
              emittedToolResultIds.add(id);
              const outputString =
                typeof message.content === "string"
                  ? message.content
                  : JSON.stringify(message.content);
              writer.write({
                type: "tool-output-available",
                toolCallId: id,
                output: outputString,
              });
              if (isAwaitingApprovalSerialized(outputString)) {
                awaitingApproval = true;
              }
            }
          }
        }

        if (awaitingApproval) {
          // The human-mode pause point. Halt the agent so it doesn't burn an
          // extra LLM call on a placeholder result the user hasn't actioned.
          abortController.abort();
          break;
        }
      }
    }
  } catch (error) {
    if (!isAbortError(error)) throw error;
  } finally {
    closeTextPart();
    writer.write({ type: "finish-step" });
    writer.write({ type: "finish" });
  }
}

function isAwaitingApprovalSerialized(content: string): boolean {
  try {
    const parsed: unknown = JSON.parse(content);
    if (!parsed || typeof parsed !== "object") return false;
    const raw = (parsed as { raw?: unknown }).raw;
    if (!raw || typeof raw !== "object") return false;
    return (raw as { status?: unknown }).status === AWAITING_APPROVAL_STATUS;
  } catch {
    return false;
  }
}

function toTextString(content: BaseMessage["content"]): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  let acc = "";
  for (const part of content) {
    if (typeof part === "string") {
      acc += part;
    } else if (part && typeof part === "object" && "text" in part) {
      const text = (part as { text?: unknown }).text;
      if (typeof text === "string") acc += text;
    }
  }
  return acc;
}

function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = (error as { name?: unknown }).name;
  return name === "AbortError";
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}
