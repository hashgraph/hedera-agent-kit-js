import { describe, it, expect } from 'vitest';
import { base64ToUtf8 } from '@/shared/utils/base64-utils';

describe('base64ToUtf8', () => {
    it('decodes a simple ASCII string', () => {
        const encoded = btoa('Hello world!');
        expect(base64ToUtf8(encoded)).toBe('Hello world!');
    });

    it('decodes an empty string', () => {
        const encoded = btoa('');
        expect(base64ToUtf8(encoded)).toBe('');
    });

    it('decodes a string with special characters', () => {
        const encoded = btoa('key=value&foo=bar');
        expect(base64ToUtf8(encoded)).toBe('key=value&foo=bar');
    });

    it('decodes a string with UTF-8 multi-byte characters', () => {
        // Manually encode a UTF-8 string with multi-byte chars
        const original = 'Héllo wörld! 🌍';
        const utf8Bytes = new TextEncoder().encode(original);
        const binaryString = Array.from(utf8Bytes)
            .map(b => String.fromCharCode(b))
            .join('');
        const encoded = btoa(binaryString);

        expect(base64ToUtf8(encoded)).toBe(original);
    });

    it('decodes a string with newlines and whitespace', () => {
        const original = 'line1\nline2\ttab';
        const encoded = btoa(original);
        expect(base64ToUtf8(encoded)).toBe(original);
    });

    it('decodes a JSON string encoded as base64', () => {
        const original = '{"topicId":"0.0.1234","message":"test"}';
        const encoded = btoa(original);
        expect(base64ToUtf8(encoded)).toBe(original);
    });
});
