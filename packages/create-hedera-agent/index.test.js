import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { scaffold } from "./index.js";

const baseConfig = {
  name: "test-project",
  operatorId: "0.0.1234",
  operatorKey: "0x" + "a".repeat(64),
  openaiKey: "sk-test",
  packageManager: "npm",
};

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "create-hedera-agent-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("scaffold integration", () => {
  it("should produce an AI SDK project with cli/index.js and no LangChain deps", async () => {
    const target = path.join(tmpDir, "ai");
    await scaffold({ ...baseConfig, framework: "ai-sdk" }, target);

    expect(fs.existsSync(path.join(target, "cli/index.js"))).toBe(true);
    expect(fs.existsSync(path.join(target, "cli/index.ai-sdk.js"))).toBe(false);
    expect(fs.existsSync(path.join(target, "cli/index.langchain.js"))).toBe(false);

    const cliBody = fs.readFileSync(path.join(target, "cli/index.js"), "utf8");
    expect(cliBody).toMatch(/from "ai"/);
    expect(cliBody).not.toMatch(/@langchain/);

    const pkg = JSON.parse(fs.readFileSync(path.join(target, "package.json"), "utf8"));
    expect(pkg.name).toBe("test-project");
    expect(pkg.dependencies).toHaveProperty("@ai-sdk/openai");
    expect(pkg.dependencies).toHaveProperty("@hashgraph/hedera-agent-kit-ai-sdk");
    expect(pkg.dependencies).not.toHaveProperty("@hashgraph/hedera-agent-kit-langchain");
    expect(pkg.dependencies).not.toHaveProperty("@langchain/core");
    expect(pkg.scripts.cli).toBe("node cli/index.js");
    expect(pkg.scripts).not.toHaveProperty("cli:ai-sdk");
    expect(pkg.scripts).not.toHaveProperty("cli:langchain");
    expect(pkg).not.toHaveProperty("runtimeDeps");
  });

  it("should produce a LangChain project with cli/index.js using @langchain and full deps", async () => {
    const target = path.join(tmpDir, "lc");
    await scaffold({ ...baseConfig, framework: "langchain" }, target);

    expect(fs.existsSync(path.join(target, "cli/index.js"))).toBe(true);
    expect(fs.existsSync(path.join(target, "cli/index.ai-sdk.js"))).toBe(false);
    expect(fs.existsSync(path.join(target, "cli/index.langchain.js"))).toBe(false);

    const cliBody = fs.readFileSync(path.join(target, "cli/index.js"), "utf8");
    expect(cliBody).toMatch(/@langchain/);

    const pkg = JSON.parse(fs.readFileSync(path.join(target, "package.json"), "utf8"));
    expect(pkg.dependencies).toHaveProperty("@ai-sdk/openai"); // web still needs AI SDK
    expect(pkg.dependencies).toHaveProperty("@hashgraph/hedera-agent-kit-langchain");
    expect(pkg.dependencies).toHaveProperty("@langchain/core");
    expect(pkg.dependencies).toHaveProperty("@langchain/langgraph");
    expect(pkg.dependencies).toHaveProperty("@langchain/openai");
    expect(pkg.scripts.cli).toBe("node cli/index.js");
    expect(pkg).not.toHaveProperty("runtimeDeps");
  });

  it("should write the .env file with the supplied credentials", async () => {
    const target = path.join(tmpDir, "env");
    await scaffold({ ...baseConfig, framework: "ai-sdk" }, target);
    const envBody = fs.readFileSync(path.join(target, ".env"), "utf8");
    expect(envBody).toMatch(/HEDERA_OPERATOR_ID=0\.0\.1234/);
    expect(envBody).toMatch(new RegExp(`HEDERA_OPERATOR_KEY=0x${"a".repeat(64)}`));
    expect(envBody).toMatch(/OPENAI_API_KEY=sk-test/);
    expect(envBody).toMatch(/LLM_PROVIDER=openai/);
  });

  it("should preserve shared/agent.js exactly between framework variants", async () => {
    const aiTarget = path.join(tmpDir, "ai");
    const lcTarget = path.join(tmpDir, "lc");
    await scaffold({ ...baseConfig, framework: "ai-sdk" }, aiTarget);
    await scaffold({ ...baseConfig, framework: "langchain" }, lcTarget);
    const aiAgent = fs.readFileSync(path.join(aiTarget, "shared/agent.js"), "utf8");
    const lcAgent = fs.readFileSync(path.join(lcTarget, "shared/agent.js"), "utf8");
    expect(aiAgent).toBe(lcAgent);
  });
});
