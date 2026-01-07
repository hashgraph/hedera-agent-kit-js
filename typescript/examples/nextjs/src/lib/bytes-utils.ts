export function extractBytesFromAgentResponse(resp: unknown): string | null {
    if (isObject(resp) && 'bytes' in resp) {
        const bytes = (resp as { bytes?: unknown }).bytes;
        try {
            const u8 = toUint8(bytes);
            return toBase64(u8);
        } catch {
        }
    }
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