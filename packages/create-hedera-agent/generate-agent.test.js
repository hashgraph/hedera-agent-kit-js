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

    it("should expose the six data exports", () => {
      const code = toString(generateAgentJs());
      expect(code).toMatch(/export const plugins = \[/);
      expect(code).toMatch(/export const mode = "auto";/);
      expect(code).toMatch(/export const hooks = /);
      expect(code).toMatch(/export const config = /);
      expect(code).toMatch(/export const systemPrompt = /);
      expect(code).toMatch(/export const client = createClient\(\);/);
    });

    it("should not emit toolkit, llm, factory, or LLM-provider imports", () => {
      const code = toString(generateAgentJs());
      expect(code).not.toMatch(/HederaAIToolkit/);
      expect(code).not.toMatch(/aiToolkit/);
      expect(code).not.toMatch(/createAIToolkit/);
      expect(code).not.toMatch(/createLLM/);
      expect(code).not.toMatch(/from "@hashgraph\/hedera-agent-kit-ai-sdk"/);
      expect(code).not.toMatch(/from "@ai-sdk\/openai"/);
      expect(code).not.toMatch(/from "@ai-sdk\/anthropic"/);
      expect(code).not.toMatch(/AgentMode as HederaAgentMode/);
      expect(code).not.toMatch(/export const tools/);
      expect(code).not.toMatch(/export const llm/);
    });

    it("should default hooks to an empty array and config to an empty object", () => {
      const code = toString(generateAgentJs());
      expect(code).toMatch(/export const hooks = \[\];/);
      expect(code).toMatch(/export const config = \{\};/);
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
            {
              key: "x",
              expression: "buildX()",
              imports: [{ package: "shared/pkg", symbols: ["buildX"] }],
            },
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
    it("should emit a config export whose values are the entry expressions verbatim", () => {
      const code = toString(
        generateAgentJs({
          pluginConfig: [
            {
              key: "saucerswap",
              expression: "{ apiKey: process.env.SAUCERSWAP_API_KEY }",
            },
            {
              key: "memejob",
              expression: 'getMemejobConfig({ mode: "live" })',
              imports: [
                { package: "memejob-plugin", symbols: ["getMemejobConfig"] },
              ],
            },
          ],
        }),
      );
      expect(code).toMatch(
        /export const config = \{\n  "saucerswap": \{ apiKey: process\.env\.SAUCERSWAP_API_KEY \},\n  "memejob": getMemejobConfig\(\{ mode: "live" \}\),\n\};/,
      );
    });

    it("should emit no extra imports when an entry has no imports field", () => {
      const code = toString(
        generateAgentJs({
          plugins: [],
          pluginConfig: [
            {
              key: "saucerswap",
              expression: "{ apiKey: process.env.SAUCERSWAP_API_KEY }",
            },
          ],
        }),
      );
      // Only the single fixed SDK import should be present — no plugin
      // package, no pluginConfig package, no toolkit/LLM imports.
      const importLines = code
        .split("\n")
        .filter((line) => line.startsWith("import "));
      expect(importLines).toHaveLength(1);
    });

    it("should merge an entry's imports into the import block, deduplicated", () => {
      const code = toString(
        generateAgentJs({
          pluginConfig: [
            {
              key: "memejob",
              expression: "getMemejobConfig()",
              imports: [{ package: "memejob-plugin", symbols: ["getMemejobConfig"] }],
            },
          ],
        }),
      );
      expect(code).toMatch(/import \{ getMemejobConfig \} from "memejob-plugin";/);
    });

    it("should default the config export to {} when no entries are supplied", () => {
      const code = toString(generateAgentJs({ pluginConfig: [] }));
      expect(code).toMatch(/export const config = \{\};/);
    });
  });

  describe("extraContext handling", () => {
    it("should default the extraContext export to {} when no entries are supplied", () => {
      const code = toString(generateAgentJs({}));
      expect(code).toMatch(/export const extraContext = \{\};/);
    });

    it("should emit each entry's expression verbatim as an object member", () => {
      const code = toString(
        generateAgentJs({
          extraContext: [
            { expression: "privateKey: `0x${operatorKey}`" },
            { expression: "network" },
          ],
        }),
      );
      expect(code).toMatch(
        /export const extraContext = \{\n  privateKey: `0x\$\{operatorKey\}`,\n  network,\n\};/,
      );
    });

    it("should merge an entry's imports into the import block, deduplicated", () => {
      const code = toString(
        generateAgentJs({
          extraContext: [
            {
              expression: "privateKey: `0x${PrivateKey.fromString(operatorKey).toStringRaw()}`",
              imports: [{ package: "@hiero-ledger/sdk", symbols: ["PrivateKey"] }],
            },
          ],
        }),
      );
      // `PrivateKey` is already in the fixed SDK import, so it must not be
      // duplicated into a second import statement.
      const sdkImportLines = code
        .split("\n")
        .filter((line) => line.includes('from "@hiero-ledger/sdk"'));
      expect(sdkImportLines).toHaveLength(1);
      expect(sdkImportLines[0]).toContain("PrivateKey");
    });

    it("should throw when an extraContext entry lacks an expression", () => {
      expect(() => generateAgentJs({ extraContext: [{}] })).toThrow(
        /extraContext\[0\]\.expression is required/,
      );
    });
  });

  describe("mode handling", () => {
    it("should set the mode export to 'human' when the wizard picks human", () => {
      const code = toString(generateAgentJs({ mode: "human" }));
      expect(code).toMatch(/export const mode = "human";/);
    });

    it("should set the mode export to 'auto' when the wizard picks auto", () => {
      const code = toString(generateAgentJs({ mode: "auto" }));
      expect(code).toMatch(/export const mode = "auto";/);
    });
  });

  describe("determinism", () => {
    it("should produce byte-identical output for the same input across calls", () => {
      const input = {
        mode: "auto",
        plugins: [{ package: "p", symbol: "x" }],
        hooks: [{ expression: "new H()", imports: [{ package: "h", symbols: ["H"] }] }],
        pluginConfig: [
          {
            key: "k",
            expression: "buildK()",
            imports: [{ package: "b", symbols: ["buildK"] }],
          },
        ],
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

    it("should throw when pluginConfig entry lacks an expression", () => {
      expect(() =>
        generateAgentJs({
          pluginConfig: [{ key: "x" }],
        }),
      ).toThrow(/pluginConfig\[0\]\.expression is required/);
    });

    it("should throw when pluginConfig entry imports lacks symbols", () => {
      expect(() =>
        generateAgentJs({
          pluginConfig: [
            {
              key: "x",
              expression: "buildX()",
              imports: [{ package: "p", symbols: [] }],
            },
          ],
        }),
      ).toThrow(/pluginConfig\[0\]\.imports\[0\]\.symbols/);
    });

    it("should throw when input is not an object", () => {
      expect(() => generateAgentJs(null)).toThrow(/input must be an object/);
    });

    it("should throw when plugins is not an array", () => {
      expect(() => generateAgentJs({ plugins: "x" })).toThrow(/plugins must be an array/);
    });
  });
});
