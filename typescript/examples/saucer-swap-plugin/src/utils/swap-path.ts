export function hexToUint8Array(hex: string): Uint8Array {
    const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex
    if (cleanHex.length % 2 !== 0) {
        throw new Error('Invalid hex string length')
    }
    const array = new Uint8Array(cleanHex.length / 2)
    for (let i = 0; i < array.length; i++) {
        array[i] = parseInt(cleanHex.substr(i * 2, 2), 16)
    }
    return array
}

export function buildEncodedPath(inputToken: string, hexFee: string, outputToken: string): Uint8Array {
    const clean = (s: string) => s.toLowerCase().replace(/^0x/, '');
    const inHex  = clean(inputToken);
    const feeHex = clean(hexFee).padStart(6, '0'); // ensure 3 bytes
    const outHex = clean(outputToken);
  
    if (inHex.length !== 40)  throw new Error(`tokenIn must be 20 bytes (40 hex), got ${inHex.length}`);
    if (feeHex.length !== 6)  throw new Error(`fee must be 3 bytes (6 hex), got ${feeHex.length}`);
    if (outHex.length !== 40) throw new Error(`tokenOut must be 20 bytes (40 hex), got ${outHex.length}`);
  
    const joined = inHex + feeHex + outHex; // total 86 hex chars (43 bytes)
    return hexToUint8Array(joined);
}


