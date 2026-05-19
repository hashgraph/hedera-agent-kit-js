import { describe, expect, it } from "vitest";

import {
  chatMessageFromUIMessage,
  chatMessageToUIMessage,
  chatMessagesFromUIMessages,
  chatMessagesToUIMessages,
  chatStatusFromAiSdk,
} from "./mappers";

describe("chatStatusFromAiSdk", () => {
  it("should map every documented ai-sdk status to the canonical equivalent", () => {
    expect(chatStatusFromAiSdk("ready")).toBe("ready");
    expect(chatStatusFromAiSdk("submitted")).toBe("submitted");
    expect(chatStatusFromAiSdk("streaming")).toBe("streaming");
    expect(chatStatusFromAiSdk("error")).toBe("error");
  });

  it("should default to ready for an unrecognized status value", () => {
    expect(chatStatusFromAiSdk("unknown")).toBe("ready");
  });
});

describe("chatMessageFromUIMessage", () => {
  it("should preserve id, role, and text parts on a user message", () => {
    const ui = {
      id: "u1",
      role: "user",
      parts: [{ type: "text", text: "hello" }],
    };
    const canonical = chatMessageFromUIMessage(ui);
    expect(canonical).toEqual({
      id: "u1",
      role: "user",
      parts: [{ type: "text", text: "hello" }],
    });
  });

  it("should preserve text part state when present", () => {
    const ui = {
      id: "a1",
      role: "assistant",
      parts: [{ type: "text", text: "wip", state: "streaming" }],
    };
    const canonical = chatMessageFromUIMessage(ui);
    expect(canonical.parts[0]).toEqual({
      type: "text",
      text: "wip",
      state: "streaming",
    });
  });

  it("should extract toolName from the tool part's type discriminator", () => {
    const ui = {
      id: "a1",
      role: "assistant",
      parts: [
        {
          type: "tool-create_topic_tool",
          toolCallId: "call-1",
          state: "input-available",
          input: { memo: "demo" },
        },
      ],
    };
    const canonical = chatMessageFromUIMessage(ui);
    expect(canonical.parts[0]).toEqual({
      type: "tool-create_topic_tool",
      toolName: "create_topic_tool",
      toolCallId: "call-1",
      state: "input-available",
      input: { memo: "demo" },
    });
  });

  it("should include output only when the tool part reached output-available", () => {
    const ui = {
      id: "a1",
      role: "assistant",
      parts: [
        {
          type: "tool-mint_fungible_token_tool",
          toolCallId: "call-2",
          state: "output-available",
          input: { tokenId: "0.0.1" },
          output: "{\"raw\":{\"status\":\"SUCCESS\"}}",
        },
      ],
    };
    const canonical = chatMessageFromUIMessage(ui);
    expect(canonical.parts[0].output).toBe(
      "{\"raw\":{\"status\":\"SUCCESS\"}}",
    );
  });

  it("should include errorText only when the tool part is output-error", () => {
    const ui = {
      id: "a1",
      role: "assistant",
      parts: [
        {
          type: "tool-transfer_hbar_tool",
          toolCallId: "call-3",
          state: "output-error",
          input: {},
          errorText: "network failure",
        },
      ],
    };
    const canonical = chatMessageFromUIMessage(ui);
    expect(canonical.parts[0]).toMatchObject({
      type: "tool-transfer_hbar_tool",
      toolName: "transfer_hbar_tool",
      toolCallId: "call-3",
      state: "output-error",
      errorText: "network failure",
    });
  });

  it("should drop parts the substrate does not consume (e.g. step markers)", () => {
    const ui = {
      id: "a1",
      role: "assistant",
      parts: [
        { type: "text", text: "ok" },
        { type: "step-start" },
      ],
    };
    const canonical = chatMessageFromUIMessage(ui);
    expect(canonical.parts).toHaveLength(1);
    expect(canonical.parts[0].type).toBe("text");
  });
});

describe("chatMessageToUIMessage", () => {
  it("should round-trip a user text message back to ai-sdk shape", () => {
    const canonical = {
      id: "u1",
      role: "user",
      parts: [{ type: "text", text: "hi" }],
    };
    const ui = chatMessageToUIMessage(canonical);
    expect(ui.id).toBe("u1");
    expect(ui.role).toBe("user");
    expect(ui.parts).toEqual([{ type: "text", text: "hi" }]);
  });

  it("should serialize tool parts back to ai-sdk's tool-{name} discriminator", () => {
    const canonical = {
      id: "a1",
      role: "assistant",
      parts: [
        {
          type: "tool-create_topic_tool",
          toolName: "create_topic_tool",
          toolCallId: "call-1",
          state: "output-available",
          input: { memo: "demo" },
          output: "{\"raw\":{\"status\":\"SUCCESS\"}}",
        },
      ],
    };
    const ui = chatMessageToUIMessage(canonical);
    const part = ui.parts[0];
    expect(part.type).toBe("tool-create_topic_tool");
    expect(part.toolCallId).toBe("call-1");
    expect(part.state).toBe("output-available");
    expect(part.input).toEqual({ memo: "demo" });
    expect(part.output).toBe("{\"raw\":{\"status\":\"SUCCESS\"}}");
  });

  it("should omit toolName from the runtime-native shape", () => {
    const canonical = {
      id: "a1",
      role: "assistant",
      parts: [
        {
          type: "tool-transfer_hbar_tool",
          toolName: "transfer_hbar_tool",
          toolCallId: "call-1",
          state: "input-available",
          input: { amount: "1" },
        },
      ],
    };
    const ui = chatMessageToUIMessage(canonical);
    const part = ui.parts[0];
    expect("toolName" in part).toBe(false);
  });
});

describe("chatMessagesFromUIMessages / chatMessagesToUIMessages", () => {
  it("should round-trip a mixed conversation without losing semantic fields", () => {
    const ui = [
      {
        id: "u1",
        role: "user",
        parts: [{ type: "text", text: "create a topic" }],
      },
      {
        id: "a1",
        role: "assistant",
        parts: [
          { type: "text", text: "On it.", state: "done" },
          {
            type: "tool-create_topic_tool",
            toolCallId: "call-1",
            state: "output-available",
            input: { memo: "demo" },
            output: "{\"raw\":{\"status\":\"SUCCESS\",\"transactionId\":\"0.0.1@1\"}}",
          },
        ],
      },
    ];

    const canonical = chatMessagesFromUIMessages(ui);
    const back = chatMessagesToUIMessages(canonical);

    expect(back).toHaveLength(2);
    expect(back[0].parts[0]).toEqual({ type: "text", text: "create a topic" });
    expect(back[1].parts).toHaveLength(2);
    const toolPart = back[1].parts[1];
    expect(toolPart.type).toBe("tool-create_topic_tool");
    expect(toolPart.state).toBe("output-available");
    expect(toolPart.output).toBe(
      "{\"raw\":{\"status\":\"SUCCESS\",\"transactionId\":\"0.0.1@1\"}}",
    );
  });

  it("should return an empty list when given an empty input", () => {
    expect(chatMessagesFromUIMessages([])).toEqual([]);
    expect(chatMessagesToUIMessages([])).toEqual([]);
  });
});
