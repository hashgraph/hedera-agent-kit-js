import { NextRequest } from 'next/server';
import { createAgentBootstrap } from '@/lib/agent-config';
import {
    PrepareSchema,
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
import { extractBytesFromAgentResponse } from '@/lib/bytes-utils';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
    try {
        const bootstrap = createAgentBootstrap();
        if (bootstrap.mode !== 'human') {
            return createErrorResponse('This endpoint is only for RETURN_BYTES (HITL) mode');
        }

        const body = await req.json();
        const { input, accountId, messages } = PrepareSchema.parse(body);

        const { tools } = createHederaToolkit(bootstrap, accountId);
        const historyMessages = transformMessagesToHistory(messages || []);
        const chatPrompt = createChatPrompt('You are a helpful assistant that returns Hedera transaction bytes for signing.');
        
        let llm;
        try {
            llm = initializeLLM();
        } catch (e) {
            return createErrorResponse(e instanceof Error ? e.message : 'Invalid AI provider configuration');
        }

        const executor = createAgentExecutorWithPrompt(llm, tools, chatPrompt, true);
        const response = await executor.invoke({ input, history: historyMessages });

        const maybeBytes = extractBytesFromAgentResponse(response);
        if (maybeBytes) {
            return createSuccessResponse({ mode: bootstrap.mode, bytesBase64: maybeBytes });
        }
        
        const result = extractResultFromResponse(response);
        return createSuccessResponse({ mode: bootstrap.mode, result });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return createErrorResponse(message);
    }
}


