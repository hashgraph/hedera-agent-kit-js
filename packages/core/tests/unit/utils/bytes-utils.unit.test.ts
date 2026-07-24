import { describe, expect, it } from 'vitest';
import { toUint8Array } from '@/shared/utils/bytes-utils';

describe('toUint8Array', () => {
  const expected = new Uint8Array([1, 2, 3, 255]);

  it('returns a Uint8Array unchanged', () => {
    const input = new Uint8Array([1, 2, 3, 255]);
    expect(toUint8Array(input)).toBe(input);
  });

  it('passes a Node Buffer through (Buffer is a Uint8Array)', () => {
    const input = Buffer.from([1, 2, 3, 255]);
    const out = toUint8Array(input);
    expect(out).toBeInstanceOf(Uint8Array);
    expect(Array.from(out)).toEqual([1, 2, 3, 255]);
  });

  it('reconstructs from a Buffer JSON shape ({ type: "Buffer", data })', () => {
    const input = JSON.parse(JSON.stringify(Buffer.from([1, 2, 3, 255])));
    expect(input).toEqual({ type: 'Buffer', data: [1, 2, 3, 255] });
    expect(toUint8Array(input)).toEqual(expected);
  });

  it('reconstructs from a numeric-keyed object (serialized Uint8Array)', () => {
    const input = JSON.parse(JSON.stringify(new Uint8Array([1, 2, 3, 255])));
    expect(input).toEqual({ '0': 1, '1': 2, '2': 3, '3': 255 });
    expect(toUint8Array(input)).toEqual(expected);
  });

  it('reconstructs from a plain number array', () => {
    expect(toUint8Array([1, 2, 3, 255])).toEqual(expected);
  });

  it('returns empty for non-byte input', () => {
    expect(toUint8Array(undefined)).toEqual(new Uint8Array());
    expect(toUint8Array(null)).toEqual(new Uint8Array());
    expect(toUint8Array('nope')).toEqual(new Uint8Array());
  });
});
