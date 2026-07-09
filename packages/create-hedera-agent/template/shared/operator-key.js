import { PrivateKey } from "@hiero-ledger/sdk";
import { resolveKeyType } from "./key-type.js";

export { resolveKeyType };

export function parseOperatorKey(key) {
  const trimmed = key.trim();
  return resolveKeyType(trimmed) === "ecdsa"
    ? PrivateKey.fromStringECDSA(trimmed)
    : PrivateKey.fromStringED25519(trimmed);
}
