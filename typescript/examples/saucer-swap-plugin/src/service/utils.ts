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
    const clean = (s: string): string => s.startsWith('0x') ? s.slice(2) : s
    const pathParts: string[] = []
    pathParts.push(clean(inputToken))
    pathParts.push(clean(hexFee))
    pathParts.push(clean(outputToken))
    return hexToUint8Array(pathParts.join(''))
}


