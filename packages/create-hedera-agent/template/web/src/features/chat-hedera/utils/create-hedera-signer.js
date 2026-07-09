import { Transaction } from "@hiero-ledger/sdk";

import { parseOperatorKey } from "./operator-key";

// Hedera-specific signer that the app passes into `<ChatWalletProvider>`.
// Keeps the SDK + key parsing inside chat-hedera so the wallet feature stays
// chain-agnostic: it just receives a `(bytes) => Promise<bytes>` function.
export function createHederaSigner(signingKey) {
  const privateKey = parseOperatorKey(signingKey);
  return async (unsignedBytesBase64) => {
    const unsigned = base64ToBytes(unsignedBytesBase64);
    const tx = Transaction.fromBytes(unsigned);
    const signed = await tx.sign(privateKey);
    return bytesToBase64(signed.toBytes());
  };
}

function base64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function bytesToBase64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
