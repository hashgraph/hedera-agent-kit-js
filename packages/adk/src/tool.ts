import { HederaAgentAPI, toUint8Array } from '@hashgraph/hedera-agent-kit';
import { FunctionTool, type ToolInputParameters } from '@google/adk';

export default function HederaAgentKitTool(
  hederaAPI: HederaAgentAPI,
  method: string,
  description: string,
  schema: ToolInputParameters,
): FunctionTool {
  // ADK format enforces a strict regex for tool names: ^[a-zA-Z0-9_-]+$
  // In case plugins have special characters like spaces or brackets, replace with _
  const sanitizedMethodName = method.replace(/[^a-zA-Z0-9_-]/g, '_');

  return new FunctionTool({
    name: sanitizedMethodName,
    description: description,
    parameters: schema,
    execute: async (arg: ThisParameterType<typeof schema>) => {
      // run() returns JSON text; a JSON round-trip strips the Uint8Array type from RETURN_BYTES
      // `bytes`, so rebuild it here (see toUint8Array) — callers get ready-to-sign bytes.
      const result = JSON.parse(await hederaAPI.run(method, arg));
      if (result?.bytes !== undefined) result.bytes = toUint8Array(result.bytes);
      if (result?.raw?.bytes !== undefined) result.raw.bytes = toUint8Array(result.raw.bytes);
      return result;
    },
  });
}
