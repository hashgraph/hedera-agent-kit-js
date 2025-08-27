import { z } from 'zod';

export const AgentRequestSchema = z.object({
    prompt: z.string().min(1).optional(),
    tool: z.string().optional(),
    params: z.record(z.any()).optional(),
});

export const AgentErrorSchema = z.object({
    ok: z.literal(false),
    error: z.string(),
});

export const AgentSuccessSchema = z.object({
    ok: z.literal(true),
    mode: z.enum(['autonomous', 'human']),
    network: z.enum(['testnet', 'mainnet']),
    result: z.unknown(),
});

export type AgentRequest = z.infer<typeof AgentRequestSchema>;
export type AgentError = z.infer<typeof AgentErrorSchema>;
export type AgentSuccess = z.infer<typeof AgentSuccessSchema>;


