import { describe, expect, it } from "vitest";

import { generateAgentJs } from "./generate-agent.js";

function toString(buf) {
  return buf.toString("utf8");
}

describe("generateAgentJs", () => {
  describe("default output", () => {
    it("should return a Buffer", () => {
      const out = generateAgentJs();
      expect(Buffer.isBuffer(out)).toBe(true);
    });

    it("should expose the eight required exports", () => {
      const code = toString(generateAgentJs());
      expect(code).toMatch(/export const plugins = \[/);
      expect(code).toMatch(/export const mode = "auto";/);
      expect(code).toMatch(/export const systemPrompt = /);
      expect(code).toMatch(/export const client = createClient\(\);/);
      expect(code).toMatch(/export const tools = aiToolkit\.getTools\(\);/);
      expect(code).toMatch(/export const llm = createLLM\(\);/);
      expect(code).toMatch(/export const hooks = /);
      expect(code).toMatch(/export const config = /);
    });

    it("should default hooks to an empty array and config to an empty object", () => {
      const code = toString(generateAgentJs());
      expect(code).toMatch(/export const hooks = \[\];/);
      expect(code).toMatch(/export const config = \{\};/);
    });

    it("should default the mode to auto and use HederaAgentMode.AUTONOMOUS in the toolkit", () => {
      const code = toString(generateAgentJs());
      expect(code).toMatch(/mode: HederaAgentMode\.AUTONOMOUS,/);
    });

    it("should thread hooks and config into HederaAIToolkit's configuration.context", () => {
      const code = toString(generateAgentJs());
      expect(code).toMatch(/context: \{ mode: HederaAgentMode\.[A-Z_]+, hooks, config \}/);
    });

    it("should import the ten core plugins from @hashgraph/hedera-agent-kit/plugins", () => {
      const code = toString(generateAgentJs());
      const importMatch = code.match(
        /import \{\n([\s\S]*?)\n\} from "@hashgraph\/hedera-agent-kit\/plugins";/,
      );
      expect(importMatch).not.toBeNull();
      const symbols = importMatch[1]
        .split("\n")
        .map((line) => line.trim().replace(/,$/, ""))
        .filter(Boolean);
      expect(symbols).toContain("coreAccountPlugin");
      expect(symbols).toContain("coreTokenPlugin");
      expect(symbols).toContain("coreConsensusPlugin");
      expect(symbols).toContain("coreEVMPlugin");
      expect(symbols).toContain("coreAccountQueryPlugin");
      expect(symbols).toContain("coreTokenQueryPlugin");
      expect(symbols).toContain("coreConsensusQueryPlugin");
      expect(symbols).toContain("coreEVMQueryPlugin");
      expect(symbols).toContain("coreMiscQueriesPlugin");
      expect(symbols).toContain("coreTransactionQueryPlugin");
      expect(symbols.length).toBe(10);
    });

    it("should not import a plugin or builder when none are needed", () => {
      const code = toString(
        generateAgentJs({ plugins: [], hooks: [], pluginConfig: [] }),
      );
      expect(code).not.toMatch(/from "@hashgraph\/hedera-agent-kit\/plugins"/);
      expect(code).toMatch(/export const plugins = \[\];/);
    });
  });

  describe("plugin handling", () => {
    it("should group multiple symbols from the same package into a single import statement", () => {
      const code = toString(
        generateAgentJs({
          plugins: [
            { package: "third-party/pkg", symbol: "alphaPlugin" },
            { package: "third-party/pkg", symbol: "betaPlugin" },
          ],
        }),
      );
      const matches = code.match(/from "third-party\/pkg";/g);
      expect(matches).toHaveLength(1);
      expect(code).toMatch(
        /import \{\n  alphaPlugin,\n  betaPlugin,\n\} from "third-party\/pkg";/,
      );
    });

    it("should deduplicate identical plugin symbols", () => {
      const code = toString(
        generateAgentJs({
          plugins: [
            { package: "p", symbol: "samePlugin" },
            { package: "p", symbol: "samePlugin" },
          ],
        }),
      );
      const matches = code.match(/samePlugin/g) || [];
      // Once in the import, twice in the plugins array (since the input had two
      // entries — dedup applies to imports only, not to the wizard's stated list).
      const importBlockMatch = code.match(/import \{\s*samePlugin\s*\} from "p";/);
      expect(importBlockMatch).not.toBeNull();
      expect(matches.length).toBeGreaterThanOrEqual(2);
    });

    it("should list every plugin entry in the plugins export in the input order", () => {
      const code = toString(
        generateAgentJs({
          plugins: [
            { package: "p1", symbol: "firstPlugin" },
            { package: "p2", symbol: "secondPlugin" },
          ],
        }),
      );
      const pluginsBlock = code.match(/export const plugins = \[\n([\s\S]*?)\n\];/);
      expect(pluginsBlock).not.toBeNull();
      expect(pluginsBlock[1]).toBe("  firstPlugin,\n  secondPlugin,");
    });
  });

  describe("hooks handling", () => {
    it("should splice each hook's expression verbatim as an array element of the hooks export", () => {
      const code = toString(
        generateAgentJs({
          hooks: [
            {
              expression: "new RejectToolPolicy([TRANSFER_HBAR_TOOL])",
              imports: [
                {
                  package: "@hashgraph/hedera-agent-kit/hooks",
                  symbols: ["RejectToolPolicy"],
                },
                {
                  package: "@hashgraph/hedera-agent-kit/tool-keys",
                  symbols: ["TRANSFER_HBAR_TOOL"],
                },
              ],
            },
          ],
        }),
      );
      expect(code).toMatch(/export const hooks = \[\n  new RejectToolPolicy\(\[TRANSFER_HBAR_TOOL\]\),\n\];/);
    });

    it("should merge hook imports into the import block", () => {
      const code = toString(
        generateAgentJs({
          hooks: [
            {
              expression: "new AuditTrailHook({ sink: 'stdout' })",
              imports: [
                {
                  package: "@hashgraph/hedera-agent-kit/hooks",
                  symbols: ["AuditTrailHook"],
                },
              ],
            },
          ],
        }),
      );
      expect(code).toMatch(/import \{ AuditTrailHook \} from "@hashgraph\/hedera-agent-kit\/hooks";/);
    });

    it("should deduplicate hook import symbols against plugin and pluginConfig imports", () => {
      const code = toString(
        generateAgentJs({
          plugins: [{ package: "shared/pkg", symbol: "sharedSymbol" }],
          hooks: [
            {
              expression: "new H()",
              imports: [
                {
                  package: "shared/pkg",
                  symbols: ["sharedSymbol", "H"],
                },
              ],
            },
          ],
          pluginConfig: [
            { key: "x", builder: { package: "shared/pkg", symbol: "buildX" } },
          ],
        }),
      );
      const importStatementMatches = code.match(/from "shared\/pkg";/g);
      expect(importStatementMatches).toHaveLength(1);
      expect(code).toMatch(
        /import \{\n  H,\n  buildX,\n  sharedSymbol,\n\} from "shared\/pkg";/,
      );
    });

    it("should leave the hooks export empty when no hooks are passed", () => {
      const code = toString(generateAgentJs({ hooks: [] }));
      expect(code).toMatch(/export const hooks = \[\];/);
    });
  });

  describe("pluginConfig handling", () => {
    it("should emit one import per builder", () => {
      const code = toString(
        generateAgentJs({
          pluginConfig: [
            { key: "saucerswap", builder: { package: "saucerswap-plugin", symbol: "getSaucerswapPluginConfig" } },
            { key: "memejob", builder: { package: "memejob-plugin", symbol: "getMemejobPluginConfig" } },
          ],
        }),
      );
      expect(code).toMatch(
        /import \{ getSaucerswapPluginConfig \} from "saucerswap-plugin";/,
      );
      expect(code).toMatch(
        /import \{ getMemejobPluginConfig \} from "memejob-plugin";/,
      );
    });

    it("should emit a config export whose values are bare call expressions to the builders", () => {
      const code = toString(
        generateAgentJs({
          pluginConfig: [
            { key: "saucerswap", builder: { package: "saucerswap-plugin", symbol: "getSaucerswapPluginConfig" } },
            { key: "memejob", builder: { package: "memejob-plugin", symbol: "getMemejobPluginConfig" } },
          ],
        }),
      );
      expect(code).toMatch(
        /export const config = \{\n  "saucerswap": getSaucerswapPluginConfig\(\),\n  "memejob": getMemejobPluginConfig\(\),\n\};/,
      );
    });

    it("should default the config export to {} when no entries are supplied", () => {
      const code = toString(generateAgentJs({ pluginConfig: [] }));
      expect(code).toMatch(/export const config = \{\};/);
    });
  });

  describe("mode handling", () => {
    it("should reflect mode 'human' as HederaAgentMode.RETURN_BYTES in the toolkit construction", () => {
      const code = toString(generateAgentJs({ mode: "human" }));
      expect(code).toMatch(/export const mode = "human";/);
      expect(code).toMatch(/mode: HederaAgentMode\.RETURN_BYTES, hooks, config/);
    });

    it("should reflect mode 'auto' as HederaAgentMode.AUTONOMOUS in the toolkit construction", () => {
      const code = toString(generateAgentJs({ mode: "auto" }));
      expect(code).toMatch(/export const mode = "auto";/);
      expect(code).toMatch(/mode: HederaAgentMode\.AUTONOMOUS, hooks, config/);
    });
  });

  describe("determinism", () => {
    it("should produce byte-identical output for the same input across calls", () => {
      const input = {
        mode: "auto",
        plugins: [{ package: "p", symbol: "x" }],
        hooks: [{ expression: "new H()", imports: [{ package: "h", symbols: ["H"] }] }],
        pluginConfig: [{ key: "k", builder: { package: "b", symbol: "buildK" } }],
      };
      expect(toString(generateAgentJs(input))).toBe(toString(generateAgentJs(input)));
    });
  });

  describe("error handling", () => {
    it("should throw when plugin lacks a package", () => {
      expect(() =>
        generateAgentJs({ plugins: [{ symbol: "x" }] }),
      ).toThrow(/plugins\[0\]\.package is required/);
    });

    it("should throw when plugin lacks a symbol", () => {
      expect(() =>
        generateAgentJs({ plugins: [{ package: "p" }] }),
      ).toThrow(/plugins\[0\]\.symbol is required/);
    });

    it("should throw on unknown mode", () => {
      expect(() => generateAgentJs({ mode: "robot" })).toThrow(/invalid mode "robot"/);
    });

    it("should throw when hook lacks an expression", () => {
      expect(() =>
        generateAgentJs({ hooks: [{ imports: [] }] }),
      ).toThrow(/hooks\[0\]\.expression is required/);
    });

    it("should throw when hook import lacks symbols", () => {
      expect(() =>
        generateAgentJs({
          hooks: [{ expression: "new H()", imports: [{ package: "h", symbols: [] }] }],
        }),
      ).toThrow(/hooks\[0\]\.imports\[0\]\.symbols/);
    });

    it("should throw when pluginConfig builder lacks a symbol", () => {
      expect(() =>
        generateAgentJs({
          pluginConfig: [{ key: "x", builder: { package: "p" } }],
        }),
      ).toThrow(/pluginConfig\[0\]\.builder\.symbol is required/);
    });

    it("should throw when input is not an object", () => {
      expect(() => generateAgentJs(null)).toThrow(/input must be an object/);
    });

    it("should throw when plugins is not an array", () => {
      expect(() => generateAgentJs({ plugins: "x" })).toThrow(/plugins must be an array/);
    });
  });
});
