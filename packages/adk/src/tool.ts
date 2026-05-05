import { HederaAgentAPI } from '@hashgraph/hedera-agent-kit';
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
            return JSON.parse(await hederaAPI.run(method, arg));
        },
    });
}
