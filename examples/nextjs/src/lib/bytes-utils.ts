import { PendingTransaction } from '@/types';

function toPendingTransaction(obj: Record<string, unknown>): PendingTransaction | null {
    if (!('bytes' in obj)) return null;
    try {
        return {
            bytesBase64: toBase64(toUint8(obj.bytes)),
            transactionId: typeof obj.transactionId === 'string' ? obj.transactionId : undefined,
            payerAccountId: typeof obj.payerAccountId === 'string' ? obj.payerAccountId : undefined,
            transactionType: typeof obj.type === 'string' ? obj.type : undefined,
            expiresAt: typeof obj.expiresAt === 'string' ? obj.expiresAt : undefined,
            memo: typeof obj.memo === 'string' && obj.memo !== '' ? obj.memo : undefined,
        };
    } catch {
        return null;
    }
}

export function extractBytesFromAgentResponse(resp: unknown): PendingTransaction | null {
    if (isObject(resp)) {
        const direct = toPendingTransaction(resp);
        if (direct) return direct;
    }
    if (isObject(resp) && 'intermediateSteps' in resp && Array.isArray((resp as { intermediateSteps?: unknown[] }).intermediateSteps)) {
        const steps = (resp as { intermediateSteps: unknown[] }).intermediateSteps;
        if (steps.length > 0 && isObject(steps[0]) && 'observation' in (steps[0] as object)) {
            const obs = (steps[0] as { observation?: unknown }).observation;
            try {
                const parsed = typeof obs === 'string' ? JSON.parse(obs) : obs;
                if (isObject(parsed)) return toPendingTransaction(parsed);
            } catch {
            }
        }
    }
    return null;
}

export function toUint8(x: unknown): Uint8Array {
    if (x instanceof Uint8Array) return x;
    if (Array.isArray(x) && x.every(n => typeof n === 'number')) return new Uint8Array(x as number[]);
    if (isObject(x) && 'data' in x && Array.isArray((x as { data?: unknown[] }).data) && (x as { data: unknown[] }).data.every(n => typeof n === 'number')) {
        return new Uint8Array((x as { data: number[] }).data);
    }
    throw new Error('Unsupported bytes payload');
}

export function toBase64(bytes: Uint8Array): string {
    if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
    let binary = '';
    bytes.forEach(b => (binary += String.fromCharCode(b)));
    return btoa(binary);
}

export function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}