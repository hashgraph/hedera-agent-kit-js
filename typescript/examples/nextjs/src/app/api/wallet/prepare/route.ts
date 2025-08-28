import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAgentBootstrap, createToolkitConfiguration, createHederaClient } from '@/lib/agent';
import { HederaLangchainToolkit } from 'hedera-agent-kit';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { AIMessage, HumanMessage } from '@langchain/core/messages';
import { createLLMFromEnv } from '@/lib/llm';

export const runtime = 'nodejs';

const PrepareSchema = z.object({
    input: z.string().min(1),
    accountId: z.string().optional(),
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
        const bootstrap = createAgentBootstrap();
        if (bootstrap.mode !== 'human') {
            return NextResponse.json(
                { error: 'This endpoint is only for RETURN_BYTES (HITL) mode' },
                { status: 400 },
            );
        }

        const body = await req.json();
        const { input, accountId, messages } = PrepareSchema.parse(body);

        const configuration = {
            ...createToolkitConfiguration(bootstrap),
            context: {
                ...bootstrap.context,
                accountId: accountId,
            },
        };
        const client = createHederaClient(bootstrap);
        const hederaToolkit = new HederaLangchainToolkit({ client, configuration });
        const tools = hederaToolkit.getTools();

        const historyMessages = (messages || []).map(m =>
            m.role === 'user' ? new HumanMessage(m.content) : new AIMessage(m.content),
        );
        const chatPrompt = ChatPromptTemplate.fromMessages([
            ['system', 'You are a helpful assistant that returns Hedera transaction bytes for signing.'],
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
        const agent = createToolCallingAgent({ llm, tools, prompt: chatPrompt });
        const executor = new AgentExecutor({ agent, tools, returnIntermediateSteps: true });
        const response = await executor.invoke({ input, history: historyMessages });

        // Normalise bytes into base64 for reliable transport
        const maybeBytes = extractBytesFromAgentResponse(response);
        if (maybeBytes) {
            return NextResponse.json({ ok: true, mode: bootstrap.mode, bytesBase64: maybeBytes });
        }
        return NextResponse.json({ ok: true, mode: bootstrap.mode, result: response });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ ok: false, error: message }, { status: 400 });
    }
}


function extractBytesFromAgentResponse(resp: unknown): string | null {
    // direct shape: { bytes: Uint8Array | { type: 'Buffer', data: number[] } }
    if (isObject(resp) && 'bytes' in resp) {
        const bytes = (resp as { bytes?: unknown }).bytes;
        try {
            const u8 = toUint8(bytes);
            return toBase64(u8);
        } catch {
            // fall through
        }
    }
    // in intermediateSteps.observation (stringified JSON or object)
    if (isObject(resp) && 'intermediateSteps' in resp && Array.isArray((resp as { intermediateSteps?: unknown[] }).intermediateSteps)) {
        const steps = (resp as { intermediateSteps: unknown[] }).intermediateSteps;
        if (steps.length > 0 && isObject(steps[0]) && 'observation' in (steps[0] as object)) {
            const obs = (steps[0] as { observation?: unknown }).observation;
            try {
                const parsed = typeof obs === 'string' ? JSON.parse(obs) : obs;
                if (isObject(parsed) && 'bytes' in parsed) {
                    const u8 = toUint8((parsed as { bytes?: unknown }).bytes);
                    return toBase64(u8);
                }
            } catch {
                // ignore
            }
        }
    }
    return null;
}

function toUint8(x: unknown): Uint8Array {
    if (x instanceof Uint8Array) return x;
    if (Array.isArray(x) && x.every(n => typeof n === 'number')) return new Uint8Array(x as number[]);
    if (isObject(x) && 'data' in x && Array.isArray((x as { data?: unknown[] }).data) && (x as { data: unknown[] }).data.every(n => typeof n === 'number')) {
        return new Uint8Array((x as { data: number[] }).data);
    }
    throw new Error('Unsupported bytes payload');
}

function toBase64(bytes: Uint8Array): string {
    if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
    let binary = '';
    bytes.forEach(b => (binary += String.fromCharCode(b)));
    return btoa(binary);
}

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

