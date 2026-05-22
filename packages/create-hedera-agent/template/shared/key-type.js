// Returns "ecdsa" | "ed25519". Raw 32-byte hex is curve-ambiguous — default
// to ECDSA (Portal convention); pass DER to force ED25519. Detect DER curves
// by the embedded ASN.1 OID, NOT by try/catching SDK parsers — the SDK's
// `fromStringECDSA` accepts ED25519 DER and silently produces a bogus key.
export function resolveKeyType(key) {
  const normalized = key.trim().toLowerCase().replace(/^0x/, "");
  if (/^[0-9a-f]{64}$/.test(normalized)) return "ecdsa";
  if (normalized.includes("06032b6570")) return "ed25519";    // 1.3.101.112
  if (normalized.includes("06052b8104000a")) return "ecdsa";  // 1.3.132.0.10
  throw new Error(
    "Unrecognized operator key format (expected ECDSA/ED25519 DER hex or 0x-prefixed 64-hex).",
  );
}
