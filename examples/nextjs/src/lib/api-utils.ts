import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AIMessage, HumanMessage } from '@langchain/core/messages';
import { Message } from '@/types';

export const RequestSchema = z.object({
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

export const PrepareSchema = RequestSchema.extend({
    accountId: z.string().optional(),
});

export function createErrorResponse(message: string, status = 400): NextResponse {
    return NextResponse.json({ ok: false, error: message }, { status });
}

export function createSuccessResponse<T>(data: T): NextResponse {
    return NextResponse.json({ ok: true, ...data });
}

export function transformMessagesToHistory(messages: Message[]): (HumanMessage | AIMessage)[] {
    return messages.map(m =>
        m.role === 'user' ? new HumanMessage(m.content) : new AIMessage(m.content),
    );
}