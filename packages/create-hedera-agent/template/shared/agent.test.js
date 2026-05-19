import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const VALID_ENV = {
  HEDERA_OPERATOR_ID: "0.0.1234",
  HEDERA_OPERATOR_KEY: "0x" + "a".repeat(64),
  HEDERA_NETWORK: "testnet",
  LLM_PROVIDER: "openai",
  LLM_MODEL: "gpt-4o-mini",
  OPENAI_API_KEY: "sk-test-fake",
};

let originalEnv;

beforeEach(() => {
  originalEnv = { ...process.env };
  vi.resetModules();
});

afterEach(() => {
  process.env = originalEnv;
  vi.resetModules();
});

function setEnv(env) {
  for (const key of Object.keys(VALID_ENV)) delete process.env[key];
  Object.assign(process.env, env);
}

describe("shared/agent", () => {
  it("should export plugins, mode, systemPrompt, client, tools, llm, hooks, config when env is set", async () => {
    setEnv(VALID_ENV);
    const mod = await import("./agent.js");
    expect(Array.isArray(mod.plugins)).toBe(true);
    expect(mod.plugins.length).toBeGreaterThan(0);
    expect(mod.mode).toMatch(/^(auto|human)$/);
    expect(typeof mod.systemPrompt).toBe("string");
    expect(mod.systemPrompt.length).toBeGreaterThan(0);
    expect(mod.client).toBeDefined();
    expect(mod.tools).toBeDefined();
    expect(mod.llm).toBeDefined();
    expect(Array.isArray(mod.hooks)).toBe(true);
    expect(mod.hooks).toEqual([]);
    expect(typeof mod.config).toBe("object");
    expect(mod.config).not.toBeNull();
    expect(Object.keys(mod.config)).toEqual([]);
  });

  it("should throw a clear error when HEDERA_OPERATOR_ID is missing", async () => {
    setEnv({ ...VALID_ENV, HEDERA_OPERATOR_ID: "" });
    await expect(import("./agent.js")).rejects.toThrow(/HEDERA_OPERATOR_ID/);
  });

  it("should throw a clear error when HEDERA_OPERATOR_KEY is missing", async () => {
    setEnv({ ...VALID_ENV, HEDERA_OPERATOR_KEY: "" });
    await expect(import("./agent.js")).rejects.toThrow(/HEDERA_OPERATOR_KEY/);
  });

  it("should throw a clear error when OPENAI_API_KEY is missing for openai provider", async () => {
    setEnv({ ...VALID_ENV, OPENAI_API_KEY: "" });
    await expect(import("./agent.js")).rejects.toThrow(/OPENAI_API_KEY/);
  });

  it("should throw a clear error when ANTHROPIC_API_KEY is missing for anthropic provider", async () => {
    setEnv({ ...VALID_ENV, LLM_PROVIDER: "anthropic", OPENAI_API_KEY: "", ANTHROPIC_API_KEY: "" });
    await expect(import("./agent.js")).rejects.toThrow(/ANTHROPIC_API_KEY/);
  });

  it("should reject an unsupported LLM_PROVIDER", async () => {
    setEnv({ ...VALID_ENV, LLM_PROVIDER: "cohere" });
    await expect(import("./agent.js")).rejects.toThrow(/LLM_PROVIDER/);
  });

  it("should reject an invalid HEDERA_NETWORK", async () => {
    setEnv({ ...VALID_ENV, HEDERA_NETWORK: "previewnet" });
    await expect(import("./agent.js")).rejects.toThrow(/HEDERA_NETWORK/);
  });
});
