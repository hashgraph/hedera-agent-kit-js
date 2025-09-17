import { NextRequest } from 'next/server';
import {
    RequestSchema,
    createErrorResponse,
    createSuccessResponse,
    transformMessagesToHistory,
} from '@/lib/api-utils';
import {
    initializeLLM,
    createHederaToolkit,
    createChatPrompt,
    createAgentExecutorWithPrompt,
    extractResultFromResponse,
} from '@/lib/agent-factory';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const parsed = RequestSchema.parse(body);
        const input = parsed.input;
        const history = parsed.messages || [];

        const { bootstrap, tools } = createHederaToolkit();
        const historyMessages = transformMessagesToHistory(history);
        const chatPrompt = createChatPrompt('You are a helpful assistant that uses Hedera tools.');
        
        let llm;
        try {
            llm = initializeLLM();
        } catch (e) {
            return createErrorResponse(e instanceof Error ? e.message : 'Invalid AI provider configuration');
        }

        const executor = createAgentExecutorWithPrompt(llm, tools, chatPrompt, false);
        const response = await executor.invoke({ input, history: historyMessages });
        const result = extractResultFromResponse(response);

        return createSuccessResponse({ 
            mode: bootstrap.mode, 
            network: bootstrap.network, 
            result 
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return createErrorResponse(message);
    }
}


