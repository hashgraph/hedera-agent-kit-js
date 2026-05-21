import { describe, expect, it } from "vitest";

import { applyScaffoldRule } from "./scaffold-rule.js";

function b(s) {
  return Buffer.from(s, "utf8");
}

function templateFileMap() {
  const pkg = {
    name: "hedera-agent-app",
    type: "module",
    scripts: {
      web: "next dev web",
      "cli:ai-sdk": "node cli/index.ai-sdk.js",
      "cli:langchain": "node cli/index.langchain.js",
      test: "vitest run",
    },
    dependencies: {
      "@ai-sdk/openai": "3.0.63",
      "@hashgraph/hedera-agent-kit": "4.0.0",
      "@hashgraph/hedera-agent-kit-ai-sdk": "1.0.0",
      "@hashgraph/hedera-agent-kit-langchain": "1.0.0",
      "@langchain/core": "1.0.0",
      "@langchain/openai": "1.0.0",
      "@langchain/langgraph": "1.0.0",
      "@langchain/anthropic": "1.0.0",
      "next": "16.2.6",
    },
    runtimeDeps: {
      langchain: [
        "@hashgraph/hedera-agent-kit-langchain",
        "@langchain/anthropic",
        "@langchain/core",
        "@langchain/langgraph",
        "@langchain/openai",
      ],
    },
  };

  return {
    "package.json": b(JSON.stringify(pkg, null, 2)),
    "shared/config.js": b("export const plugins = [];\n"),
    "cli/index.ai-sdk.js": b("// AI SDK CLI\n"),
    "cli/index.langchain.js": b("// LangChain CLI\n"),
    "web/src/app/page.jsx": b("export default function Page() {}\n"),
    "README.md": b("# Hedera Agent App\n"),
  };
}

describe("applyScaffoldRule", () => {
  describe("ai-sdk framework", () => {
    it("should rename cli/index.ai-sdk.js to cli/index.js and drop the langchain variant", () => {
      const result = applyScaffoldRule(templateFileMap(), "ai-sdk");
      expect(Object.keys(result)).toContain("cli/index.js");
      expect(Object.keys(result)).not.toContain("cli/index.ai-sdk.js");
      expect(Object.keys(result)).not.toContain("cli/index.langchain.js");
      expect(result["cli/index.js"].toString("utf8")).toContain("AI SDK CLI");
    });

    it("should remove every dependency listed under runtimeDeps.langchain", () => {
      const result = applyScaffoldRule(templateFileMap(), "ai-sdk");
      const pkg = JSON.parse(result["package.json"].toString("utf8"));
      expect(pkg.dependencies).not.toHaveProperty("@hashgraph/hedera-agent-kit-langchain");
      expect(pkg.dependencies).not.toHaveProperty("@langchain/anthropic");
      expect(pkg.dependencies).not.toHaveProperty("@langchain/core");
      expect(pkg.dependencies).not.toHaveProperty("@langchain/langgraph");
      expect(pkg.dependencies).not.toHaveProperty("@langchain/openai");
    });

    it("should retain AI SDK and shared dependencies", () => {
      const result = applyScaffoldRule(templateFileMap(), "ai-sdk");
      const pkg = JSON.parse(result["package.json"].toString("utf8"));
      expect(pkg.dependencies).toHaveProperty("@ai-sdk/openai");
      expect(pkg.dependencies).toHaveProperty("@hashgraph/hedera-agent-kit");
      expect(pkg.dependencies).toHaveProperty("@hashgraph/hedera-agent-kit-ai-sdk");
      expect(pkg.dependencies).toHaveProperty("next");
    });

    it("should drop the runtimeDeps field", () => {
      const result = applyScaffoldRule(templateFileMap(), "ai-sdk");
      const pkg = JSON.parse(result["package.json"].toString("utf8"));
      expect(pkg).not.toHaveProperty("runtimeDeps");
    });

    it("should consolidate cli scripts into a single cli script", () => {
      const result = applyScaffoldRule(templateFileMap(), "ai-sdk");
      const pkg = JSON.parse(result["package.json"].toString("utf8"));
      expect(pkg.scripts.cli).toBe("node cli/index.js");
      expect(pkg.scripts).not.toHaveProperty("cli:ai-sdk");
      expect(pkg.scripts).not.toHaveProperty("cli:langchain");
      expect(pkg.scripts.web).toBe("next dev web");
      expect(pkg.scripts.test).toBe("vitest run");
    });

    it("should leave non-suffix files untouched", () => {
      const result = applyScaffoldRule(templateFileMap(), "ai-sdk");
      expect(result["shared/config.js"].toString("utf8")).toBe("export const plugins = [];\n");
      expect(result["web/src/app/page.jsx"].toString("utf8")).toBe(
        "export default function Page() {}\n",
      );
      expect(result["README.md"].toString("utf8")).toBe("# Hedera Agent App\n");
    });
  });

  describe("langchain framework", () => {
    it("should rename cli/index.langchain.js to cli/index.js and drop the ai-sdk variant", () => {
      const result = applyScaffoldRule(templateFileMap(), "langchain");
      expect(Object.keys(result)).toContain("cli/index.js");
      expect(Object.keys(result)).not.toContain("cli/index.ai-sdk.js");
      expect(Object.keys(result)).not.toContain("cli/index.langchain.js");
      expect(result["cli/index.js"].toString("utf8")).toContain("LangChain CLI");
    });

    it("should retain both AI SDK and LangChain dependencies", () => {
      const result = applyScaffoldRule(templateFileMap(), "langchain");
      const pkg = JSON.parse(result["package.json"].toString("utf8"));
      expect(pkg.dependencies).toHaveProperty("@ai-sdk/openai");
      expect(pkg.dependencies).toHaveProperty("@hashgraph/hedera-agent-kit-langchain");
      expect(pkg.dependencies).toHaveProperty("@langchain/core");
      expect(pkg.dependencies).toHaveProperty("@langchain/openai");
      expect(pkg.dependencies).toHaveProperty("@langchain/langgraph");
      expect(pkg.dependencies).toHaveProperty("@langchain/anthropic");
    });

    it("should drop the runtimeDeps field for langchain too", () => {
      const result = applyScaffoldRule(templateFileMap(), "langchain");
      const pkg = JSON.parse(result["package.json"].toString("utf8"));
      expect(pkg).not.toHaveProperty("runtimeDeps");
    });

    it("should consolidate cli scripts into a single cli script", () => {
      const result = applyScaffoldRule(templateFileMap(), "langchain");
      const pkg = JSON.parse(result["package.json"].toString("utf8"));
      expect(pkg.scripts.cli).toBe("node cli/index.js");
      expect(pkg.scripts).not.toHaveProperty("cli:ai-sdk");
      expect(pkg.scripts).not.toHaveProperty("cli:langchain");
    });
  });

  describe("error handling", () => {
    it("should throw on an unknown framework", () => {
      expect(() =>
        applyScaffoldRule(templateFileMap(), "mastra"),
      ).toThrow(/Unknown framework/);
    });

    it("should not mutate the input file map", () => {
      const input = templateFileMap();
      const inputKeys = Object.keys(input).sort();
      applyScaffoldRule(input, "ai-sdk");
      expect(Object.keys(input).sort()).toEqual(inputKeys);
      expect(input["cli/index.ai-sdk.js"]).toBeDefined();
      expect(input["cli/index.langchain.js"]).toBeDefined();
    });
  });

  describe("idempotency", () => {
    it("should be a no-op on a file map with no runtime-suffixed files", () => {
      const minimal = {
        "shared/config.js": b("// agent\n"),
        "README.md": b("# readme\n"),
      };
      const result = applyScaffoldRule(minimal, "ai-sdk");
      expect(result["shared/config.js"].toString("utf8")).toBe("// agent\n");
      expect(result["README.md"].toString("utf8")).toBe("# readme\n");
    });
  });
});
