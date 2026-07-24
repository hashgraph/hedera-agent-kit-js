import { HederaAgentAPI } from '@hashgraph/hedera-agent-kit';
import { tool, Tool } from 'ai';
import z from 'zod';

export default function HederaAgentKitTool(
  hederaAPI: HederaAgentAPI,
  method: string,
  description: string,
  schema: z.ZodObject<any, any>,
): Tool {
  return tool({
    type: undefined,
    description: description,
    inputSchema: schema,
    execute: (arg: z.output<typeof schema>) => {
      return hederaAPI.run(method, arg);
    },
  });
}
