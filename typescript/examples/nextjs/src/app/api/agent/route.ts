import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { HederaLangchainToolkit } from 'hedera-agent-kit';
import { createAgentBootstrap, createHederaClient, createToolkitConfiguration } from '@/lib/agent';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { AIMessage, HumanMessage } from '@langchain/core/messages';
import { createLLMFromEnv } from '@/lib/llm';

export const runtime = 'nodejs';

const RequestSchema = z.object({
    input: z.string().min(1),
    messages: z
        .array(
            z.object({
                role: z.enum(['user', 'assistant']),
                content: z.string(),
            }),
        )
        .optional(),
});

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const parsed = RequestSchema.parse(body);
        const input = parsed.input;
        const history = parsed.messages || [];

        const bootstrap = createAgentBootstrap();
        const client = createHederaClient(bootstrap);
        const configuration = createToolkitConfiguration(bootstrap);

        const hederaToolkit = new HederaLangchainToolkit({ client, configuration });
        const tools = hederaToolkit.getTools();

        const historyMessages = history.map(m =>
            m.role === 'user' ? new HumanMessage(m.content) : new AIMessage(m.content),
        );
        const chatPrompt = ChatPromptTemplate.fromMessages([
            ['system', 'You are a helpful assistant that uses Hedera tools.'],
            new MessagesPlaceholder('history'),
            ['human', '{input}'],
            ['placeholder', '{agent_scratchpad}'],
        ]);
        let llm;
        try {
            llm = createLLMFromEnv();
        } catch (e) {
            const message = e instanceof Error ? e.message : 'Invalid AI provider configuration';
            return NextResponse.json({ ok: false, error: message }, { status: 400 });
        }
        const executor = new AgentExecutor({
            agent: createToolCallingAgent({ llm, tools, prompt: chatPrompt }),
            tools,
            returnIntermediateSteps: false,
        });

        const response = await executor.invoke({ input, history: historyMessages });
        return NextResponse.json({ ok: true, mode: bootstrap.mode, network: bootstrap.network, result: response });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ ok: false, error: message }, { status: 400 });
    }
}


