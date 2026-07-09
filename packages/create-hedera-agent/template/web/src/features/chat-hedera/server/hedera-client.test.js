import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readEnv } from "@/features/chat-hedera/server/hedera-client";

const ENV_KEYS = ["HEDERA_ACCOUNT_ID", "HEDERA_PRIVATE_KEY"];

// A real ECDSA hex private key so `parseOperatorKey` accepts it and the public
// key derivation produces a non-empty DER string.
const ECDSA_PRIVATE_KEY =
  "0x4242424242424242424242424242424242424242424242424242424242424242";

describe("readEnv", () => {
  let snapshot;

  beforeEach(() => {
    snapshot = {};
    for (const key of ENV_KEYS) {
      snapshot[key] = process.env[key];
      delete process.env[key];
    }
  });
  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (snapshot[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = snapshot[key];
      }
    }
  });

  it("should return id, key, and a derived public key when env is complete", () => {
    process.env.HEDERA_ACCOUNT_ID = "0.0.1234";
    process.env.HEDERA_PRIVATE_KEY = ECDSA_PRIVATE_KEY;

    const env = readEnv();

    expect(env.operatorId).toBe("0.0.1234");
    expect(env.operatorKey).toBe(ECDSA_PRIVATE_KEY);
    expect(env.operatorPublicKey).toMatch(/^[0-9a-f]+$/i);
    expect(env.operatorPublicKey.length).toBeGreaterThan(0);
  });

  it("should throw when HEDERA_ACCOUNT_ID is missing", () => {
    process.env.HEDERA_PRIVATE_KEY = ECDSA_PRIVATE_KEY;

    expect(() => readEnv()).toThrow(/HEDERA_ACCOUNT_ID/);
  });

  it("should throw when HEDERA_PRIVATE_KEY is missing", () => {
    process.env.HEDERA_ACCOUNT_ID = "0.0.1234";

    expect(() => readEnv()).toThrow(/HEDERA_PRIVATE_KEY/);
  });
});
