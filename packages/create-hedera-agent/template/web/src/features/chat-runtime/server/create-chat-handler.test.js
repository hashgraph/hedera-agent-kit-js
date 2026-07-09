import { describe, expect, it, vi, beforeEach } from "vitest";

import { createChatHandler } from "./create-chat-handler";

const streamTextMock = vi.fn();
vi.mock("ai", async () => {
  const actual = await vi.importActual("ai");
  return {
    ...actual,
    streamText: (options) => streamTextMock(options),
    convertToModelMessages: (messages) => messages,
  };
});

beforeEach(() => {
  streamTextMock.mockReset();
});

function buildToolset(overrides = {}) {
  // The handler only forwards the tools object to `streamText`; it does not
  // introspect the schema, so an opaque placeholder is sufficient for these
  // contract tests.
  const placeholder = {};
  return {
    tools: { noop_tool: placeholder },
    mutatingToolMethods: new Set(),
    ...overrides,
  };
}

function buildToolsetProvider(overrides = {}) {
  return () => buildToolset(overrides);
}

function buildRequest(body) {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const fakeLLM = { id: "model" };

describe("createChatHandler", () => {
  it("should call streamText with the resolved system prompt, tools, and messages", async () => {
    const fakeResponse = new Response("ok");
    streamTextMock.mockReturnValue({
      toUIMessageStreamResponse: () => fakeResponse,
    });

    const toolset = buildToolset();
    const handler = createChatHandler({
      llm: fakeLLM,
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

    const toolset = buildToolset({
      mutatingToolMethods: new Set([
        "transfer_hbar_tool",
        "create_topic_tool",
      ]),
    });

    const handler = createChatHandler({
      llm: fakeLLM,
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

    const getTools = vi.fn(() => buildToolset());
    const getSystemPrompt = vi.fn(() => "p");

    const handler = createChatHandler({ llm: fakeLLM, getTools, getSystemPrompt });
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
      llm: fakeLLM,
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
      llm: fakeLLM,
      getTools: buildToolsetProvider(),
      getSystemPrompt: () => "p",
    });
    const res = await handler(buildRequest({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/messages/);
    expect(streamTextMock).not.toHaveBeenCalled();
  });

  it("should propagate provider errors so the route can translate them", async () => {
    class CustomError extends Error {}
    const handler = createChatHandler({
      llm: fakeLLM,
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
