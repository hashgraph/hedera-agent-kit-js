import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Tool } from "ai";

import {
  createChatHandler,
  type ChatHandlerToolset,
} from "./create-chat-handler";

// Pull the LLM provider behind a stub so the handler can exercise its
// `streamText` plumbing without hitting a live model. `createLLM` is imported
// inside `create-chat-handler.ts`; replacing it here means the test never
// requires real provider credentials.
const createLLMMock = vi.fn();
vi.mock("./llm", () => ({
  createLLM: () => createLLMMock(),
}));

const streamTextMock = vi.fn();
vi.mock("ai", async () => {
  const actual = await vi.importActual<typeof import("ai")>("ai");
  return {
    ...actual,
    streamText: (options: unknown) => streamTextMock(options),
    convertToModelMessages: (messages: unknown) => messages,
  };
});

beforeEach(() => {
  createLLMMock.mockReset();
  streamTextMock.mockReset();
});

function buildToolset(overrides: Partial<ChatHandlerToolset> = {}): ChatHandlerToolset {
  // The handler only forwards the tools object to `streamText`; it does not
  // introspect the schema, so an opaque placeholder is sufficient for these
  // contract tests.
  const placeholder = {} as unknown as Tool;
  return {
    tools: { noop_tool: placeholder },
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

describe("createChatHandler", () => {
  it("should call streamText with the resolved system prompt, tools, and messages", async () => {
    const fakeResponse = new Response("ok");
    streamTextMock.mockReturnValue({
      toUIMessageStreamResponse: () => fakeResponse,
    });
    createLLMMock.mockReturnValue({ id: "model" });

    const toolset = buildToolset();
    const handler = createChatHandler({
      getTools: () => toolset,
      getSystemPrompt: () => "system prompt",
    });

    const messages = [{ id: "u1", role: "user", parts: [] }];
    const res = await handler(buildRequest({ messages, mode: "auto" }));

    expect(res).toBe(fakeResponse);
    expect(streamTextMock).toHaveBeenCalledTimes(1);
    const call = streamTextMock.mock.calls[0][0];
    expect(call.system).toBe("system prompt");
    expect(call.tools).toBe(toolset.tools);
    expect(call.messages).toEqual(messages);
  });

  it("should install a stop condition per mutating tool method", async () => {
    const fakeResponse = new Response("ok");
    streamTextMock.mockReturnValue({
      toUIMessageStreamResponse: () => fakeResponse,
    });
    createLLMMock.mockReturnValue({ id: "model" });

    const toolset = buildToolset({
      mutatingToolMethods: new Set([
        "transfer_hbar_tool",
        "create_topic_tool",
      ]),
    });

    const handler = createChatHandler({
      getTools: () => toolset,
      getSystemPrompt: () => "p",
    });

    await handler(buildRequest({ messages: [], mode: "human" }));
    const call = streamTextMock.mock.calls[0][0];
    // One step-count limit plus one per mutating tool method.
    expect(call.stopWhen).toHaveLength(3);
  });

  it("should forward the parsed request body to the tool and system-prompt providers", async () => {
    streamTextMock.mockReturnValue({
      toUIMessageStreamResponse: () => new Response("ok"),
    });
    createLLMMock.mockReturnValue({ id: "model" });

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

  it("should short-circuit when validateRequest returns a Response", async () => {
    const handler = createChatHandler({
      getTools: buildToolsetProvider(),
      getSystemPrompt: () => "p",
      validateRequest: () =>
        new Response(JSON.stringify({ error: "nope" }), { status: 418 }),
    });

    const res = await handler(buildRequest({ messages: [] }));
    expect(res.status).toBe(418);
    expect(streamTextMock).not.toHaveBeenCalled();
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
    expect(streamTextMock).not.toHaveBeenCalled();
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
