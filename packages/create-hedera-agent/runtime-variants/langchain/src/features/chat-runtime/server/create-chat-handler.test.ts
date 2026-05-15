import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  AIMessage,
  AIMessageChunk,
  ToolMessage,
  type BaseMessage,
} from "@langchain/core/messages";
import type { StructuredToolInterface } from "@langchain/core/tools";

import {
  createChatHandler,
  type ChatHandlerToolset,
} from "./create-chat-handler";

// Pull the LLM provider behind a stub so the handler can exercise its
// agent-loop plumbing without hitting a live model.
const createLLMMock = vi.fn();
vi.mock("./llm", () => ({
  createLLM: () => createLLMMock(),
}));

// Fake langchain agent: returns the event sequence the test prepared. The real
// agent is created via `createAgent` from `langchain`; we replace it so each
// test can drive the stream directly.
type FakeEvent = ["messages" | "updates", unknown];
let nextEvents: FakeEvent[] = [];
const createAgentMock = vi.fn((_options: unknown) => ({
  stream: vi.fn(async () =>
    (async function* () {
      for (const event of nextEvents) yield event;
    })(),
  ),
}));
vi.mock("langchain", () => ({
  createAgent: (options: unknown) => createAgentMock(options),
}));

beforeEach(() => {
  createLLMMock.mockReset();
  createAgentMock.mockClear();
  nextEvents = [];
});

function buildToolset(
  overrides: Partial<ChatHandlerToolset> = {},
): ChatHandlerToolset {
  const placeholder = {
    name: "noop_tool",
    description: "noop",
  } as unknown as StructuredToolInterface;
  return {
    tools: [placeholder],
    mutatingToolMethods: new Set<string>(),
    ...overrides,
  };
}

function buildToolsetProvider(
  overrides: Partial<ChatHandlerToolset> = {},
): () => ChatHandlerToolset {
  return () => buildToolset(overrides);
}

function buildRequest(body: unknown): Request {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function readStreamText(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let out = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    out += decoder.decode(value);
  }
  return out;
}

describe("createChatHandler", () => {
  it("should call createAgent with the resolved system prompt and tools", async () => {
    createLLMMock.mockReturnValue({ id: "model" });
    nextEvents = [];

    const toolset = buildToolset();
    const handler = createChatHandler({
      getTools: () => toolset,
      getSystemPrompt: () => "system prompt",
    });

    const messages = [
      { id: "u1", role: "user", parts: [{ type: "text", text: "hi" }] },
    ];
    await handler(buildRequest({ messages, mode: "auto" }));

    expect(createAgentMock).toHaveBeenCalledTimes(1);
    const call = createAgentMock.mock.calls[0][0] as unknown as {
      systemPrompt: string;
      tools: StructuredToolInterface[];
    };
    expect(call.systemPrompt).toBe("system prompt");
    expect(call.tools).toBe(toolset.tools);
  });

  it("should forward the parsed request body to the tool and system-prompt providers", async () => {
    createLLMMock.mockReturnValue({ id: "model" });
    nextEvents = [];

    const getTools = vi.fn(() => buildToolset());
    const getSystemPrompt = vi.fn(() => "p");

    const handler = createChatHandler({ getTools, getSystemPrompt });
    await handler(
      buildRequest({ messages: [], mode: "human", extra: "value" }),
    );

    expect(getTools).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "human", extra: "value" }),
    );
    expect(getSystemPrompt).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "human", extra: "value" }),
    );
  });

  it("should adapt langchain message events to the ai-sdk UIMessage stream", async () => {
    createLLMMock.mockReturnValue({ id: "model" });

    // Stream a single text chunk followed by completion.
    const chunk = new AIMessageChunk({ content: "Hello!" });
    nextEvents = [["messages", [chunk, {}] as [BaseMessage, Record<string, unknown>]]];

    const handler = createChatHandler({
      getTools: buildToolsetProvider(),
      getSystemPrompt: () => "p",
    });

    const res = await handler(buildRequest({ messages: [] }));
    const body = await readStreamText(res);

    // The exact framing comes from `createUIMessageStream`; we only assert
    // that the text payload made it through and that the stream lifecycle
    // markers are present.
    expect(body).toContain("Hello!");
    expect(body).toContain("text-delta");
    expect(body).toContain("finish");
  });

  it("should emit tool-input-available and tool-output-available for completed tool calls", async () => {
    createLLMMock.mockReturnValue({ id: "model" });

    const aiMsg = new AIMessage({
      content: "",
      tool_calls: [
        {
          id: "call-1",
          name: "transfer_hbar_tool",
          args: { to: "0.0.1234", amount: 5 },
          type: "tool_call",
        },
      ],
    });
    const toolMsg = new ToolMessage({
      content: '{"raw":{"status":"SUCCESS"}}',
      tool_call_id: "call-1",
      name: "transfer_hbar_tool",
    });
    nextEvents = [
      ["updates", { agent: { messages: [aiMsg] } }],
      ["updates", { tools: { messages: [toolMsg] } }],
    ];

    const handler = createChatHandler({
      getTools: buildToolsetProvider({
        mutatingToolMethods: new Set(["transfer_hbar_tool"]),
      }),
      getSystemPrompt: () => "p",
    });

    const res = await handler(buildRequest({ messages: [] }));
    const body = await readStreamText(res);

    expect(body).toContain("tool-input-available");
    expect(body).toContain("tool-output-available");
    expect(body).toContain("call-1");
    expect(body).toContain("transfer_hbar_tool");
  });

  it("should halt streaming when a tool result carries the AWAITING_APPROVAL status", async () => {
    createLLMMock.mockReturnValue({ id: "model" });

    const aiMsg = new AIMessage({
      content: "",
      tool_calls: [
        {
          id: "call-1",
          name: "transfer_hbar_tool",
          args: {},
          type: "tool_call",
        },
      ],
    });
    const awaitingMsg = new ToolMessage({
      content: JSON.stringify({
        raw: {
          status: "AWAITING_APPROVAL",
          toolName: "transfer_hbar_tool",
          unsignedBytes: "deadbeef",
        },
        humanMessage: "approve",
      }),
      tool_call_id: "call-1",
      name: "transfer_hbar_tool",
    });
    const followUpChunk = new AIMessageChunk({ content: "should not appear" });
    nextEvents = [
      ["updates", { agent: { messages: [aiMsg] } }],
      ["updates", { tools: { messages: [awaitingMsg] } }],
      ["messages", [followUpChunk, {}]],
    ];

    const handler = createChatHandler({
      getTools: buildToolsetProvider({
        mutatingToolMethods: new Set(["transfer_hbar_tool"]),
      }),
      getSystemPrompt: () => "p",
    });

    const res = await handler(buildRequest({ messages: [] }));
    const body = await readStreamText(res);

    expect(body).toContain("AWAITING_APPROVAL");
    expect(body).not.toContain("should not appear");
  });

  it("should short-circuit when validateRequest returns a Response", async () => {
    const handler = createChatHandler({
      getTools: buildToolsetProvider(),
      getSystemPrompt: () => "p",
      validateRequest: () =>
        new Response(JSON.stringify({ error: "nope" }), { status: 418 }),
    });

    const res = await handler(buildRequest({ messages: [] }));
    expect(res.status).toBe(418);
    expect(createAgentMock).not.toHaveBeenCalled();
  });

  it("should reject requests whose body is missing a messages array with 400", async () => {
    const handler = createChatHandler({
      getTools: buildToolsetProvider(),
      getSystemPrompt: () => "p",
    });
    const res = await handler(buildRequest({}));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toMatch(/messages/);
    expect(createAgentMock).not.toHaveBeenCalled();
  });

  it("should propagate provider errors so the route can translate them", async () => {
    class CustomError extends Error {}
    const handler = createChatHandler({
      getTools: () => {
        throw new CustomError("boom");
      },
      getSystemPrompt: () => "p",
    });

    await expect(handler(buildRequest({ messages: [] }))).rejects.toBeInstanceOf(
      CustomError,
    );
  });
});
