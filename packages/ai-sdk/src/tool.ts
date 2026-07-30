import { HederaAgentAPI, toUint8Array, type ToolType } from '@hashgraph/hedera-agent-kit';
import { tool, type Tool } from 'ai';
import z from 'zod';

/** AI SDK tool object augmented with a HAK `toolType` field for read-only filtering. */
export type HederaAITool = Tool & { toolType?: ToolType };

export default function HederaAgentKitTool(
  hederaAPI: HederaAgentAPI,
  method: string,
  description: string,
  schema: z.ZodObject<any, any>,
  toolType?: ToolType,
): HederaAITool {
  const aiTool = tool({
    type: undefined,
    description: description,
    inputSchema: schema,
    execute: async (arg: z.output<typeof schema>) => {
      // Return the structured tool output as an object (the AI SDK preserves it in
      // `toolResult.output`). A JSON round-trip strips the Uint8Array type from RETURN_BYTES
      // `bytes`, so rebuild it here (see toUint8Array) — callers get ready-to-sign bytes.
      const result = JSON.parse(await hederaAPI.run(method, arg));
      if (result?.bytes !== undefined) result.bytes = toUint8Array(result.bytes);
      if (result?.raw?.bytes !== undefined) result.raw.bytes = toUint8Array(result.raw.bytes);
      return result;
    },
  }) as HederaAITool;
  aiTool.toolType = toolType;
  return aiTool;
}
