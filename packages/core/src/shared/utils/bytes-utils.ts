/**
 * Reconstruct a `Uint8Array` from transaction bytes that have survived a JSON round-trip.
 *
 * Tool output is serialized to JSON text (over MCP, the AI SDK, or a framework ToolMessage),
 * and JSON has no typed-array type. After `JSON.parse` the `bytes` field is no longer a
 * `Uint8Array`, and `Transaction.fromBytes` rejects it. Depending on what produced the bytes
 * and where they were serialized, the shape differs — this normalizes every case:
 *
 * - already a `Uint8Array` (a Node `Buffer` included) — returned as-is
 * - Node `Buffer` JSON — `{ type: 'Buffer', data: number[] }` (what `Buffer.toJSON()` emits)
 * - plain number array — `[1, 2, 3]`
 * - numeric-keyed object — `{ '0': 1, '1': 2 }` (what a plain `Uint8Array` serializes to)
 *
 * Anything else yields an empty `Uint8Array`.
 */
export const toUint8Array = (bytes: unknown): Uint8Array => {
  if (bytes instanceof Uint8Array) return bytes;
  if (Array.isArray(bytes)) return new Uint8Array(bytes);
  if (typeof bytes === 'object' && bytes !== null) {
    const maybeBuffer = bytes as { type?: unknown; data?: unknown };
    if (maybeBuffer.type === 'Buffer' && Array.isArray(maybeBuffer.data)) {
      return new Uint8Array(maybeBuffer.data as number[]);
    }
    return new Uint8Array(Object.values(bytes) as number[]);
  }
  return new Uint8Array();
};
