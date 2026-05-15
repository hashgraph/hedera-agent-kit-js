import { AgentMode as HederaAgentMode } from "@hashgraph/hedera-agent-kit";
import { HederaLangchainToolkit } from "@hashgraph/hedera-agent-kit-langchain";
import type { StructuredToolInterface } from "@langchain/core/tools";
import { DynamicStructuredTool } from "@langchain/core/tools";

import { summarize } from "@/features/chat-hedera/utils/transaction-summaries";
import type { AgentMode } from "@/features/chat-hedera/utils/agent-mode";
// Imports resolve through the `@/` alias (not relative paths) because this
// file is the only chat-hedera overlay shipped with the langchain variant —
// `hedera-client`, `mutating-tools`, and `plugins` stay in the template and
// are reused by both runtime variants.
import {
  createHederaClient,
  createReturnBytesHederaClient,
  readEnv,
} from "@/features/chat-hedera/server/hedera-client";
import { getMutatingToolMethods } from "@/features/chat-hedera/server/mutating-tools";
import { plugins } from "@/features/chat-hedera/server/plugins";

// Status emitted by mutating tools in `human` mode. Carried inside the standard
// `{ raw, humanMessage }` envelope so the client uses the same parser path as
// for real Hedera results. Only the `raw.status` value differs.
export const AWAITING_APPROVAL_STATUS = "AWAITING_APPROVAL";

export type AwaitingApprovalPayload = {
  raw: {
    status: typeof AWAITING_APPROVAL_STATUS;
    toolName: string;
    input: unknown;
    summary: ReturnType<typeof summarize>;
    unsignedBytes?: string;
  };
  humanMessage: string;
};

export type HederaToolkit = {
  tools: StructuredToolInterface[];
  mutatingToolMethods: Set<string>;
};

export function createHederaToolkit({ mode }: { mode: AgentMode }): HederaToolkit {
  const mutatingToolMethods = getMutatingToolMethods(plugins);

  if (mode === "human") {
    const env = readEnv();
    const baseToolkit = new HederaLangchainToolkit({
      client: createReturnBytesHederaClient(env),
      configuration: {
        plugins,
        context: {
          mode: HederaAgentMode.RETURN_BYTES,
          accountId: env.operatorId,
          accountPublicKey: env.operatorPublicKey,
        },
      },
    });
    const baseTools = baseToolkit.getTools();
    const tools = baseTools.map((baseTool) =>
      mutatingToolMethods.has(baseTool.name)
        ? wrapForApproval(baseTool)
        : baseTool,
    );
    return { tools, mutatingToolMethods };
  }

  const baseToolkit = new HederaLangchainToolkit({
    client: createHederaClient(),
    configuration: {
      plugins,
      context: { mode: HederaAgentMode.AUTONOMOUS },
    },
  });
  return {
    tools: baseToolkit.getTools(),
    mutatingToolMethods,
  };
}

// Wraps mutating tools so the kit's RETURN_BYTES output (a `{ bytes }` object)
// is repackaged into the AWAITING_APPROVAL envelope the client parses.
function wrapForApproval(
  baseTool: StructuredToolInterface,
): StructuredToolInterface {
  return new DynamicStructuredTool({
    name: baseTool.name,
    description: baseTool.description,
    schema: baseTool.schema as DynamicStructuredTool["schema"],
    func: async (input: unknown) => {
      const rawResult = await baseTool.invoke(input as Record<string, unknown>);
      const unsignedBytes = extractBytesAsBase64(rawResult);
      if (!unsignedBytes) {
        // The kit didn't return bytes (validation error fell through). Pass
        // the original output back unchanged.
        return typeof rawResult === "string"
          ? rawResult
          : JSON.stringify(rawResult);
      }
      const payload: AwaitingApprovalPayload = {
        raw: {
          status: AWAITING_APPROVAL_STATUS,
          toolName: baseTool.name,
          input,
          summary: summarize(baseTool.name, input),
          unsignedBytes,
        },
        humanMessage:
          "Awaiting user approval. The user must sign the transaction externally and submit the signed bytes. Do not call any further tools.",
      };
      return JSON.stringify(payload);
    },
  });
}

function extractBytesAsBase64(result: unknown): string | null {
  if (typeof result === "string") {
    try {
      const parsed = JSON.parse(result) as unknown;
      return extractBytesAsBase64(parsed);
    } catch {
      return null;
    }
  }
  if (!result || typeof result !== "object") return null;
  const bytes = (result as { bytes?: unknown }).bytes;
  if (!bytes) return null;
  if (typeof bytes === "string") return bytes;
  if (bytes instanceof Uint8Array) {
    return Buffer.from(bytes).toString("base64");
  }
  if (Array.isArray(bytes)) {
    return Buffer.from(bytes as number[]).toString("base64");
  }
  if (typeof bytes === "object") {
    const values = Object.values(bytes as Record<string, unknown>);
    if (values.every((v) => typeof v === "number")) {
      return Buffer.from(values as number[]).toString("base64");
    }
  }
  return null;
}

export function isAwaitingApprovalPayload(
  value: unknown,
): value is AwaitingApprovalPayload {
  if (!value || typeof value !== "object") return false;
  const raw = (value as { raw?: unknown }).raw;
  if (!raw || typeof raw !== "object") return false;
  return (raw as { status?: unknown }).status === AWAITING_APPROVAL_STATUS;
}
