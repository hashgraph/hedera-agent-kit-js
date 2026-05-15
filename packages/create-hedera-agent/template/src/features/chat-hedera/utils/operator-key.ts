import { PrivateKey } from "@hiero-ledger/sdk";

// Parses a Hedera operator key string into a SDK `PrivateKey`. Accepts ECDSA in
// DER hex (3030...) or 0x-prefixed 64-hex; everything else is treated as ED25519.
// Used by the server-side client factories and by the browser-side wallet
// simulator, so it deliberately avoids any Node-only APIs.
export function parseOperatorKey(key: string): PrivateKey {
  const trimmed = key.trim();
  if (/^303002/i.test(trimmed) || /^(0x)?[0-9a-fA-F]{64}$/.test(trimmed)) {
    return PrivateKey.fromStringECDSA(trimmed);
  }
  return PrivateKey.fromStringED25519(trimmed);
}
