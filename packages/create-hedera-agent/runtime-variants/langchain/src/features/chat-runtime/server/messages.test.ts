import { describe, expect, it } from "vitest";
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";

import type { ChatMessage } from "@/features/chat/types";
import { chatMessagesToBaseMessages } from "./messages";

describe("chatMessagesToBaseMessages", () => {
  it("should convert a user message with text parts into a HumanMessage", () => {
    const messages: ChatMessage[] = [
      {
        id: "m1",
        role: "user",
        parts: [{ type: "text", text: "Hello agent" }],
      },
    ];

    const result = chatMessagesToBaseMessages(messages);

    expect(result).toHaveLength(1);
    expect(result[0]).toBeInstanceOf(HumanMessage);
    expect(result[0].content).toBe("Hello agent");
  });

  it("should convert a system message into a SystemMessage", () => {
    const messages: ChatMessage[] = [
      {
        id: "s1",
        role: "system",
        parts: [{ type: "text", text: "You are a Hedera assistant." }],
      },
    ];

    const result = chatMessagesToBaseMessages(messages);

    expect(result).toHaveLength(1);
    expect(result[0]).toBeInstanceOf(SystemMessage);
  });

  it("should concatenate multiple text parts in one message", () => {
    const messages: ChatMessage[] = [
      {
        id: "m1",
        role: "user",
        parts: [
          { type: "text", text: "Hello " },
          { type: "text", text: "agent" },
        ],
      },
    ];

    const result = chatMessagesToBaseMessages(messages);

    expect(result[0].content).toBe("Hello agent");
  });

  it("should convert an assistant turn with a completed tool call into AIMessage + ToolMessage", () => {
    const messages: ChatMessage[] = [
      {
        id: "a1",
        role: "assistant",
        parts: [
          { type: "text", text: "Calling tool now." },
          {
            type: "tool-transfer_hbar",
            toolName: "transfer_hbar",
            toolCallId: "call-1",
            state: "output-available",
            input: { to: "0.0.1234", amount: 5 },
            output: '{"raw":{"status":"SUCCESS","transactionId":"0.0.x@123"}}',
          },
        ],
      },
    ];

    const result = chatMessagesToBaseMessages(messages);

    expect(result).toHaveLength(2);

    const ai = result[0] as AIMessage;
    expect(ai).toBeInstanceOf(AIMessage);
    expect(ai.content).toBe("Calling tool now.");
    expect(ai.tool_calls).toEqual([
      {
        id: "call-1",
        name: "transfer_hbar",
        args: { to: "0.0.1234", amount: 5 },
        type: "tool_call",
      },
    ]);

    const tool = result[1] as ToolMessage;
    expect(tool).toBeInstanceOf(ToolMessage);
    expect(tool.tool_call_id).toBe("call-1");
    expect(tool.content).toBe(
      '{"raw":{"status":"SUCCESS","transactionId":"0.0.x@123"}}',
    );
  });

  it("should emit a tool call without a ToolMessage when the output is not yet available", () => {
    // A reload mid-approval lands here: the assistant has emitted a tool call,
    // but the user hasn't clicked Approve/Reject yet. Including a ToolMessage
    // with a stub result would confuse the LLM on resume.
    const messages: ChatMessage[] = [
      {
        id: "a1",
        role: "assistant",
        parts: [
          {
            type: "tool-create_token",
            toolName: "create_token",
            toolCallId: "call-2",
            state: "input-available",
            input: { name: "Token" },
          },
        ],
      },
    ];

    const result = chatMessagesToBaseMessages(messages);

    expect(result).toHaveLength(1);
    expect(result[0]).toBeInstanceOf(AIMessage);
    const ai = result[0] as AIMessage;
    expect(ai.tool_calls).toHaveLength(1);
    expect(ai.tool_calls?.[0]?.id).toBe("call-2");
  });

  it("should preserve cross-message order through a multi-turn conversation", () => {
    const messages: ChatMessage[] = [
      {
        id: "u1",
        role: "user",
        parts: [{ type: "text", text: "First question" }],
      },
      {
        id: "a1",
        role: "assistant",
        parts: [{ type: "text", text: "First answer" }],
      },
      {
        id: "u2",
        role: "user",
        parts: [{ type: "text", text: "Follow-up" }],
      },
    ];

    const result = chatMessagesToBaseMessages(messages);

    expect(result.map((m) => m._getType())).toEqual(["human", "ai", "human"]);
    expect(result.map((m) => m.content)).toEqual([
      "First question",
      "First answer",
      "Follow-up",
    ]);
  });

  it("should serialize non-string tool outputs as JSON", () => {
    const messages: ChatMessage[] = [
      {
        id: "a1",
        role: "assistant",
        parts: [
          {
            type: "tool-query_balance",
            toolName: "query_balance",
            toolCallId: "call-3",
            state: "output-available",
            input: { accountId: "0.0.1234" },
            output: { raw: { balance: 100 }, humanMessage: "Balance is 100" },
          },
        ],
      },
    ];

    const result = chatMessagesToBaseMessages(messages);

    const tool = result[1] as ToolMessage;
    expect(tool.content).toBe(
      JSON.stringify({
        raw: { balance: 100 },
        humanMessage: "Balance is 100",
      }),
    );
  });

  it("should convert an output-error tool part into a structured failure result", () => {
    const messages: ChatMessage[] = [
      {
        id: "a1",
        role: "assistant",
        parts: [
          {
            type: "tool-transfer_hbar",
            toolName: "transfer_hbar",
            toolCallId: "call-4",
            state: "output-error",
            input: { to: "0.0.1234", amount: 999999999 },
            errorText: "INSUFFICIENT_PAYER_BALANCE",
          },
        ],
      },
    ];

    const result = chatMessagesToBaseMessages(messages);

    const tool = result[1] as ToolMessage;
    expect(tool.tool_call_id).toBe("call-4");
    const parsed = JSON.parse(tool.content as string);
    expect(parsed.raw.status).toBe("ERROR");
    expect(parsed.raw.error).toBe("INSUFFICIENT_PAYER_BALANCE");
    expect(parsed.humanMessage).toBe("INSUFFICIENT_PAYER_BALANCE");
  });

  it("should strip raw.unsignedBytes from tool outputs before handing back to the model", () => {
    const messages: ChatMessage[] = [
      {
        id: "a1",
        role: "assistant",
        parts: [
          {
            type: "tool-transfer_hbar",
            toolName: "transfer_hbar",
            toolCallId: "call-5",
            state: "output-available",
            input: {},
            output: JSON.stringify({
              raw: {
                status: "AWAITING_APPROVAL",
                unsignedBytes: "deadbeef",
              },
              humanMessage: "approve",
            }),
          },
        ],
      },
    ];

    const result = chatMessagesToBaseMessages(messages);
    const tool = result[1] as ToolMessage;
    const parsed = JSON.parse(tool.content as string);
    expect(parsed.raw.unsignedBytes).toBeUndefined();
    expect(parsed.raw.status).toBe("AWAITING_APPROVAL");
  });
});
