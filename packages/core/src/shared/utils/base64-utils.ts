/**
 * Converts a base64 string to a UTF-8 string.
 * @param base64 - The base64 string to convert.
 */
export const base64ToUtf8 = (base64: string): string => {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
};
