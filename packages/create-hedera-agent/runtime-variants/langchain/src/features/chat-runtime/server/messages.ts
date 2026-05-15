import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
  type BaseMessage,
} from "@langchain/core/messages";

import type {
  ChatMessage,
  ChatMessagePart,
  ChatToolPart,
} from "@/features/chat/types";

// Server-side translation between the substrate's canonical chat messages and
// LangChain's BaseMessage history. The chat handler converts the inbound wire
// format (ai-sdk UIMessage[]) → canonical → BaseMessage[] so the agent sees a
// runtime-native history that preserves tool-call / tool-output pairs.
export function chatMessagesToBaseMessages(
  messages: ReadonlyArray<ChatMessage>,
): BaseMessage[] {
  const out: BaseMessage[] = [];
  for (const message of messages) {
    if (message.role === "system") {
      const text = extractText(message.parts);
      if (text) out.push(new SystemMessage(text));
      continue;
    }
    if (message.role === "user") {
      const text = extractText(message.parts);
      if (text) out.push(new HumanMessage(text));
      continue;
    }
    if (message.role === "assistant") {
      const text = extractText(message.parts);
      const toolCalls = collectToolCalls(message.parts);

      // The assistant turn that issued the tool calls. Even if the LLM emitted
      // no surrounding text, the BaseMessage still has to exist so each tool
      // output below can reference its tool_call_id back to the right call.
      out.push(
        new AIMessage({
          content: text,
          tool_calls: toolCalls.map(({ id, name, input }) => ({
            id,
            name,
            args: (input ?? {}) as Record<string, unknown>,
            type: "tool_call",
          })),
        }),
      );

      for (const call of toolCalls) {
        if (call.output === undefined) continue;
        out.push(
          new ToolMessage({
            content: serializeToolOutputForModel(call.output),
            tool_call_id: call.id,
            name: call.name,
          }),
        );
      }
    }
  }
  return out;
}

type CollectedToolCall = {
  id: string;
  name: string;
  input: unknown;
  // `output` is undefined while the tool call is still in-flight on the client
  // (e.g. an awaiting-approval card that hasn't been actioned yet). The agent
  // run that follows must NOT include a phantom ToolMessage for it — without a
  // matching result, the LLM would fail validation on most providers.
  output: unknown | undefined;
};

function collectToolCalls(parts: ChatMessagePart[]): CollectedToolCall[] {
  const collected: CollectedToolCall[] = [];
  for (const part of parts) {
    if (part.type === "text") continue;
    const tool = part as ChatToolPart;
    collected.push({
      id: tool.toolCallId,
      name: tool.toolName,
      input: tool.input,
      output: extractOutput(tool),
    });
  }
  return collected;
}

function extractText(parts: ChatMessagePart[]): string {
  let acc = "";
  for (const part of parts) {
    if (part.type === "text") acc += part.text;
  }
  return acc;
}

function extractOutput(part: ChatToolPart): unknown | undefined {
  if (part.state === "output-available") return part.output;
  if (part.state === "output-error") {
    // The LangChain agent receives the error message as the tool result so it
    // can react via the system prompt's "explain failure" contract. Mirrors
    // what the AI SDK runtime would inject when a tool throws.
    return {
      raw: { status: "ERROR", error: part.errorText ?? "Unknown error" },
      humanMessage: part.errorText ?? "Tool returned an error",
    };
  }
  return undefined;
}

function serializeToolOutputForModel(output: unknown): string {
  // Scrub `raw.unsignedBytes` before handing the history back to the LLM: the
  // bytes are a client-side affordance (rendered by the transaction card) and
  // have no reason to live in the model's context. Keeping them out also stops
  // the LLM from echoing the base64 back as a code block in subsequent turns.
  const stripped = stripUnsignedBytes(output);
  return typeof stripped === "string" ? stripped : JSON.stringify(stripped);
}

function stripUnsignedBytes(output: unknown): unknown {
  if (typeof output === "string") {
    try {
      return stripUnsignedBytes(JSON.parse(output));
    } catch {
      return output;
    }
  }
  if (!output || typeof output !== "object" || Array.isArray(output)) return output;
  const envelope = output as Record<string, unknown>;
  const raw = envelope.raw;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return envelope;
  const { unsignedBytes: _omit, ...restRaw } = raw as Record<string, unknown>;
  return { ...envelope, raw: restRaw };
}
