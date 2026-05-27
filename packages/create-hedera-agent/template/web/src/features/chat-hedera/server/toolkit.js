import { AgentMode as HederaAgentMode } from "@hashgraph/hedera-agent-kit";
import { HederaAIToolkit } from "@hashgraph/hedera-agent-kit-ai-sdk";
import { tool } from "ai";

import { summarize } from "@/features/chat-hedera/utils/transaction-summaries";
import {
  createHederaClient,
  createReturnBytesHederaClient,
  readEnv,
} from "./hedera-client";
import { getMutatingToolMethods } from "./mutating-tools";
// Pure data from `shared/config.js`: the plugins/hooks/per-plugin config the
// wizard (or a manual editor) owns. The web stays in lockstep with the CLI
// because both read these from the same file.
import { config, extraContext, hooks, plugins } from "../../../../../shared/config.js";

// Status emitted by mutating tools in `human` mode. Carried inside the standard
// `{ raw, humanMessage }` envelope so the client uses the same parser path as
// for real Hedera results. Only the `raw.status` value differs.
export const AWAITING_APPROVAL_STATUS = "AWAITING_APPROVAL";

export function createHederaToolkit({ mode }) {
  const mutatingToolMethods = getMutatingToolMethods(plugins);

  if (mode === "human") {
    const env = readEnv();
    const baseToolkit = new HederaAIToolkit({
      client: createReturnBytesHederaClient(env),
      configuration: {
        plugins,
        context: {
          mode: HederaAgentMode.RETURN_BYTES,
          accountId: env.operatorId,
          accountPublicKey: env.operatorPublicKey,
          hooks,
          config,
          ...extraContext,
        },
      },
    });
    const baseTools = baseToolkit.getTools();
    return {
      tools: wrapMutatingToolsForApproval(baseTools, mutatingToolMethods),
      mutatingToolMethods,
    };
  }

  const baseToolkit = new HederaAIToolkit({
    client: createHederaClient(),
    configuration: {
      plugins,
      context: { mode: HederaAgentMode.AUTONOMOUS, hooks, config, ...extraContext },
    },
  });
  return {
    tools: baseToolkit.getTools(),
    mutatingToolMethods,
  };
}

// Wraps every mutating tool so the kit's RETURN_BYTES output (a `{ bytes }`
// object) is repackaged into the AWAITING_APPROVAL envelope the client expects.
// Read-only tools pass through unchanged. Their outputs are tool results, not
// transactions, regardless of mode.
function wrapMutatingToolsForApproval(baseTools, mutating) {
  const wrapped = {};
  for (const [name, baseTool] of Object.entries(baseTools)) {
    if (!mutating.has(name)) {
      wrapped[name] = baseTool;
      continue;
    }
    wrapped[name] = tool({
      description: baseTool.description,
      inputSchema: baseTool.inputSchema,
      execute: async (input, options) => {
        if (typeof baseTool.execute !== "function") {
          throw new Error(`Tool "${name}" has no execute method`);
        }
        const result = await baseTool.execute(input, options);
        const unsignedBytes = extractBytesAsBase64(result);
        if (!unsignedBytes) {
          // The kit didn't return bytes (e.g. a validation error fell through).
          // Pass the original tool output back so the agent loop can react.
          return result;
        }
        const payload = {
          raw: {
            status: AWAITING_APPROVAL_STATUS,
            toolName: name,
            input,
            summary: summarize(name, input),
            unsignedBytes,
          },
          humanMessage:
            "Awaiting user approval. The user must sign the transaction externally and submit the signed bytes. Do not call any further tools.",
        };
        return JSON.stringify(payload);
      },
      // The bytes are a client-only affordance: the transaction card renders
      // them, the model has no reason to read or repeat them. Forking the
      // model-visible output here scrubs them out so the LLM doesn't echo the
      // base64 into its reply text. The rest of the envelope (status, tool
      // name, input, summary) is still visible so the model can acknowledge.
      toModelOutput: ({ output }) => {
        const parsed = parseToolOutputForModel(output);
        const value =
          parsed !== null
            ? JSON.stringify(parsed)
            : typeof output === "string"
              ? output
              : JSON.stringify(output);
        return { type: "text", value };
      },
    });
  }
  return wrapped;
}

function extractBytesAsBase64(result) {
  if (typeof result === "string") {
    try {
      const parsed = JSON.parse(result);
      return extractBytesAsBase64(parsed);
    } catch {
      return null;
    }
  }
  if (!result || typeof result !== "object") return null;
  const bytes = result.bytes;
  if (!bytes) return null;
  if (typeof bytes === "string") return bytes;
  if (bytes instanceof Uint8Array) {
    return Buffer.from(bytes).toString("base64");
  }
  if (Array.isArray(bytes)) {
    return Buffer.from(bytes).toString("base64");
  }
  // Some AI-SDK serializers turn Uint8Array into `{ "0": 0x12, "1": 0x34, ... }`.
  if (typeof bytes === "object") {
    const values = Object.values(bytes);
    if (values.every((v) => typeof v === "number")) {
      return Buffer.from(values).toString("base64");
    }
  }
  return null;
}

// Reparses the JSON-stringified envelope produced by `execute` and removes
// `raw.unsignedBytes` before handing it back to the model. Returning a JSON
// object (rather than a string) avoids a second round-trip through
// JSON.stringify on the way to the LLM.
function parseToolOutputForModel(output) {
  if (typeof output !== "string") {
    if (output && typeof output === "object" && !Array.isArray(output)) {
      return stripBytes(output);
    }
    return null;
  }
  try {
    const parsed = JSON.parse(output);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return stripBytes(parsed);
  } catch {
    return null;
  }
}

function stripBytes(envelope) {
  const raw = envelope.raw;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return envelope;
  const { unsignedBytes: _omit, ...restRaw } = raw;
  return { ...envelope, raw: restRaw };
}

export function isAwaitingApprovalPayload(value) {
  if (!value || typeof value !== "object") return false;
  const raw = value.raw;
  if (!raw || typeof raw !== "object") return false;
  return raw.status === AWAITING_APPROVAL_STATUS;
}
