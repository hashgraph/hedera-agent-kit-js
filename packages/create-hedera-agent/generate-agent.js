// Pure-function emitter for `shared/config.js`.
//
// Takes a structured input describing wizard selections (mode, plugins, hooks,
// per-plugin config builders) and returns the contents of the file as a
// Buffer. Same family as `applyScaffoldRule` and `readTemplateFileMap`: no I/O,
// deterministic, callable from the Hedera Portal's browser-side download
// pipeline.

const DEFAULT_PLUGINS = [
  { package: "@hashgraph/hedera-agent-kit/plugins", symbol: "coreAccountPlugin" },
  { package: "@hashgraph/hedera-agent-kit/plugins", symbol: "coreTokenPlugin" },
  { package: "@hashgraph/hedera-agent-kit/plugins", symbol: "coreConsensusPlugin" },
  { package: "@hashgraph/hedera-agent-kit/plugins", symbol: "coreEVMPlugin" },
  { package: "@hashgraph/hedera-agent-kit/plugins", symbol: "coreAccountQueryPlugin" },
  { package: "@hashgraph/hedera-agent-kit/plugins", symbol: "coreTokenQueryPlugin" },
  { package: "@hashgraph/hedera-agent-kit/plugins", symbol: "coreConsensusQueryPlugin" },
  { package: "@hashgraph/hedera-agent-kit/plugins", symbol: "coreEVMQueryPlugin" },
  { package: "@hashgraph/hedera-agent-kit/plugins", symbol: "coreMiscQueriesPlugin" },
  { package: "@hashgraph/hedera-agent-kit/plugins", symbol: "coreTransactionQueryPlugin" },
];

const MODE_TO_AGENT_MODE_CONSTANT = {
  auto: "HederaAgentMode.AUTONOMOUS",
  human: "HederaAgentMode.RETURN_BYTES",
};

const DEFAULT_SYSTEM_PROMPT = `You are a Hedera Agent assistant. You help users interact with the Hedera network through the Hedera Agent Kit.

## Runtime context

- Operator account: \\\`\${operatorId}\\\`
- Network: \\\`\${network}\\\`
- Mode: \\\`\${mode}\\\`

## Behavior contract

- Never invent account IDs, token IDs, transaction IDs, or contract addresses. If a value is required and you do not have it, ask the user for it.
- Never ask the user to confirm before calling a read-only query tool (balance lookups, account info, transaction history, token info, network info, mirror-node queries). Call the tool immediately and report the result.
- Only ask the user for input that is genuinely missing from the request — e.g. an unspecified recipient account for a transfer. Do not ask for permission to proceed; the HITL gate (when active) is handled by the UI, not by you.
- When a user rejects a transaction, treat it as a clarification opportunity — ask a focused follow-up question. Do not apologize, do not retry the same call.
- When a transaction fails on the network, explain the failure in plain language and suggest a concrete fix. Do not silently retry.
- When a transaction succeeds, confirm it briefly and reference the real transaction ID returned by the tool.

## Mode-specific behavior

- In \\\`human\\\` mode every mutating call returns unsigned transaction bytes for the user to sign offline and submit. Frame proposals as actions the user is about to sign and submit themselves.
- When a tool returns \\\`status: AWAITING_APPROVAL\\\`, briefly acknowledge that the user needs to sign the transaction externally and stop — do not call any further tools. The conversation resumes automatically once the user submits the signed bytes (or rejects).
- **Never include raw transaction bytes, base64 blobs, or hex payloads in your reply text.** The transaction card already shows them to the user with a Copy button. Your role is to describe the action in plain English, not to mirror machine data.
- When a tool returns \\\`status: REJECTED\\\`, treat it the same as a user rejection: ask a focused clarifying question, do not retry, do not apologize.
- In \\\`auto\\\` mode the server signs and submits with the operator key. State what you did once it is done.

## Formatting

- Markdown is the only accepted output format. Never emit LaTeX, MathML, HTML, XML, BBCode, or any other markup.
- Render numeric calculations as plain prose or as a markdown list.
- Wrap account IDs, token IDs, transaction IDs, and EVM addresses in backticks.
- Use fenced code blocks for multi-line snippets.
`;

export function generateAgentJs(input = {}) {
  const { mode, plugins, hooks, pluginConfig, extraContext } = normalize(input);
  const importBlock = renderImports(plugins, hooks, pluginConfig, extraContext);
  const pluginsArray = renderPlugins(plugins);
  const hooksArray = renderHooks(hooks);
  const configObject = renderConfig(pluginConfig);
  const extraContextObject = renderExtraContext(extraContext);

  const body = `${importBlock}
// --- Environment ------------------------------------------------------------

const operatorId = requireEnv("HEDERA_ACCOUNT_ID");
const operatorKey = requireEnv("HEDERA_PRIVATE_KEY");
const network = (process.env.HEDERA_NETWORK || "testnet").toLowerCase();
if (network !== "testnet" && network !== "mainnet") {
  throw new Error(\`HEDERA_NETWORK must be "testnet" or "mainnet" (got "\${network}").\`);
}

// --- Wiring (edit this file to change the agent's behavior) ----------------

export const plugins = ${pluginsArray};

export const mode = ${JSON.stringify(mode)};

export const hooks = ${hooksArray};

export const config = ${configObject};

// Additional top-level fields injected into each toolkit's \`context\` object
// by the CLI and web runtimes. Plugins can use this to provide context values
// that belong at the top level instead of under \`config\` (for example, MPPX
// requires \`privateKey\` and \`network\`). Defaults to \`{}\`, so spreading
// \`...extraContext\` is always safe, even when no plugin provides extra fields.
export const extraContext = ${extraContextObject};

export const systemPrompt = \`${DEFAULT_SYSTEM_PROMPT}\`;

// --- Derived runtime objects ------------------------------------------------

// Hedera SDK client bound to the operator key. Consumed by both CLI runtimes
// when constructing their toolkits. The web app builds its own per-request
// clients and does not import this export.
export const client = createClient();

// --- Helpers ----------------------------------------------------------------

function requireEnv(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(
      \`\${name} is required. Set it in your .env file before starting the app.\`,
    );
  }
  return value.trim();
}

function parseOperatorKey(key) {
  const trimmed = key.trim();
  if (/^303002/i.test(trimmed) || /^(0x)?[0-9a-fA-F]{64}$/.test(trimmed)) {
    return PrivateKey.fromStringECDSA(trimmed);
  }
  return PrivateKey.fromStringED25519(trimmed);
}

function createClient() {
  const base = network === "mainnet" ? Client.forMainnet() : Client.forTestnet();
  base.setOperator(AccountId.fromString(operatorId), parseOperatorKey(operatorKey));
  return base;
}
`;

  return Buffer.from(body, "utf8");
}

function normalize(input) {
  if (input === null || typeof input !== "object") {
    throw new Error("generateAgentJs: input must be an object.");
  }
  const mode = input.mode ?? "auto";
  if (!Object.prototype.hasOwnProperty.call(MODE_TO_AGENT_MODE_CONSTANT, mode)) {
    throw new Error(
      `generateAgentJs: invalid mode "${mode}". Expected "auto" or "human".`,
    );
  }

  const plugins = input.plugins ?? DEFAULT_PLUGINS;
  if (!Array.isArray(plugins)) {
    throw new Error("generateAgentJs: plugins must be an array.");
  }
  plugins.forEach((p, i) => validatePackagedSymbol(p, `plugins[${i}]`));

  const hooks = input.hooks ?? [];
  if (!Array.isArray(hooks)) {
    throw new Error("generateAgentJs: hooks must be an array.");
  }
  hooks.forEach((h, i) => validateHookEntry(h, `hooks[${i}]`));

  const pluginConfig = input.pluginConfig ?? [];
  if (!Array.isArray(pluginConfig)) {
    throw new Error("generateAgentJs: pluginConfig must be an array.");
  }
  pluginConfig.forEach((entry, i) => validatePluginConfigEntry(entry, `pluginConfig[${i}]`));

  const extraContext = input.extraContext ?? [];
  if (!Array.isArray(extraContext)) {
    throw new Error("generateAgentJs: extraContext must be an array.");
  }
  extraContext.forEach((entry, i) => validateExtraContextEntry(entry, `extraContext[${i}]`));

  return { mode, plugins, hooks, pluginConfig, extraContext };
}

function validatePackagedSymbol(value, path) {
  if (value === null || typeof value !== "object") {
    throw new Error(`generateAgentJs: ${path} must be an object with "package" and "symbol".`);
  }
  if (typeof value.package !== "string" || !value.package.trim()) {
    throw new Error(`generateAgentJs: ${path}.package is required and must be a non-empty string.`);
  }
  if (typeof value.symbol !== "string" || !value.symbol.trim()) {
    throw new Error(`generateAgentJs: ${path}.symbol is required and must be a non-empty string.`);
  }
}

function validateHookEntry(value, path) {
  if (value === null || typeof value !== "object") {
    throw new Error(`generateAgentJs: ${path} must be an object with "expression" and "imports".`);
  }
  if (typeof value.expression !== "string" || !value.expression.trim()) {
    throw new Error(
      `generateAgentJs: ${path}.expression is required and must be a non-empty string.`,
    );
  }
  const imports = value.imports ?? [];
  if (!Array.isArray(imports)) {
    throw new Error(`generateAgentJs: ${path}.imports must be an array.`);
  }
  imports.forEach((imp, i) => {
    if (imp === null || typeof imp !== "object") {
      throw new Error(`generateAgentJs: ${path}.imports[${i}] must be an object.`);
    }
    if (typeof imp.package !== "string" || !imp.package.trim()) {
      throw new Error(
        `generateAgentJs: ${path}.imports[${i}].package is required and must be a non-empty string.`,
      );
    }
    if (!Array.isArray(imp.symbols) || imp.symbols.length === 0) {
      throw new Error(
        `generateAgentJs: ${path}.imports[${i}].symbols must be a non-empty array of strings.`,
      );
    }
    imp.symbols.forEach((sym, j) => {
      if (typeof sym !== "string" || !sym.trim()) {
        throw new Error(
          `generateAgentJs: ${path}.imports[${i}].symbols[${j}] must be a non-empty string.`,
        );
      }
    });
  });
}

function validateExtraContextEntry(value, path) {
  if (value === null || typeof value !== "object") {
    throw new Error(`generateAgentJs: ${path} must be an object with "expression" and "imports".`);
  }
  if (typeof value.expression !== "string" || !value.expression.trim()) {
    throw new Error(
      `generateAgentJs: ${path}.expression is required and must be a non-empty string.`,
    );
  }
  const imports = value.imports ?? [];
  if (!Array.isArray(imports)) {
    throw new Error(`generateAgentJs: ${path}.imports must be an array.`);
  }
  imports.forEach((imp, i) => {
    if (imp === null || typeof imp !== "object") {
      throw new Error(`generateAgentJs: ${path}.imports[${i}] must be an object.`);
    }
    if (typeof imp.package !== "string" || !imp.package.trim()) {
      throw new Error(
        `generateAgentJs: ${path}.imports[${i}].package is required and must be a non-empty string.`,
      );
    }
    if (!Array.isArray(imp.symbols) || imp.symbols.length === 0) {
      throw new Error(
        `generateAgentJs: ${path}.imports[${i}].symbols must be a non-empty array of strings.`,
      );
    }
    imp.symbols.forEach((sym, j) => {
      if (typeof sym !== "string" || !sym.trim()) {
        throw new Error(
          `generateAgentJs: ${path}.imports[${i}].symbols[${j}] must be a non-empty string.`,
        );
      }
    });
  });
}

function validatePluginConfigEntry(value, path) {
  if (value === null || typeof value !== "object") {
    throw new Error(`generateAgentJs: ${path} must be an object with "key" and "expression".`);
  }
  if (typeof value.key !== "string" || !value.key.trim()) {
    throw new Error(`generateAgentJs: ${path}.key is required and must be a non-empty string.`);
  }
  if (typeof value.expression !== "string" || !value.expression.trim()) {
    throw new Error(
      `generateAgentJs: ${path}.expression is required and must be a non-empty string.`,
    );
  }
  const imports = value.imports ?? [];
  if (!Array.isArray(imports)) {
    throw new Error(`generateAgentJs: ${path}.imports must be an array.`);
  }
  imports.forEach((imp, i) => {
    if (imp === null || typeof imp !== "object") {
      throw new Error(`generateAgentJs: ${path}.imports[${i}] must be an object.`);
    }
    if (typeof imp.package !== "string" || !imp.package.trim()) {
      throw new Error(
        `generateAgentJs: ${path}.imports[${i}].package is required and must be a non-empty string.`,
      );
    }
    if (!Array.isArray(imp.symbols) || imp.symbols.length === 0) {
      throw new Error(
        `generateAgentJs: ${path}.imports[${i}].symbols must be a non-empty array of strings.`,
      );
    }
    imp.symbols.forEach((sym, j) => {
      if (typeof sym !== "string" || !sym.trim()) {
        throw new Error(
          `generateAgentJs: ${path}.imports[${i}].symbols[${j}] must be a non-empty string.`,
        );
      }
    });
  });
}

function renderImports(plugins, hooks, pluginConfig, extraContext = []) {
  // The emitted `shared/config.js` is data-only. The only fixed import it
  // needs is the SDK types used by the operator-bound `client` export — the
  // toolkit, AI SDK, and HederaAgentMode imports moved into each runtime.
  const SDK_PACKAGE = "@hiero-ledger/sdk";
  const SDK_FIXED_SYMBOLS = new Set(["AccountId", "Client", "PrivateKey"]);
  const fixed = [
    `import { ${[...SDK_FIXED_SYMBOLS].join(", ")} } from "${SDK_PACKAGE}";`,
  ];

  const wizardImports = new Map();
  const addImport = (pkg, symbol) => {
    // Symbols already covered by the fixed SDK import must not be re-emitted —
    // a plugin/hook/extraContext entry requesting e.g. `PrivateKey` from the
    // SDK (MPPX does) would otherwise produce a duplicate import statement.
    if (pkg === SDK_PACKAGE && SDK_FIXED_SYMBOLS.has(symbol)) return;
    if (!wizardImports.has(pkg)) wizardImports.set(pkg, new Set());
    wizardImports.get(pkg).add(symbol);
  };

  for (const p of plugins) addImport(p.package, p.symbol);
  for (const h of hooks) {
    for (const imp of h.imports ?? []) {
      for (const sym of imp.symbols) addImport(imp.package, sym);
    }
  }
  for (const entry of pluginConfig) {
    for (const imp of entry.imports ?? []) {
      for (const sym of imp.symbols) addImport(imp.package, sym);
    }
  }
  for (const entry of extraContext) {
    for (const imp of entry.imports ?? []) {
      for (const sym of imp.symbols) addImport(imp.package, sym);
    }
  }

  const wizard = [];
  for (const [pkg, symbols] of wizardImports.entries()) {
    const sorted = [...symbols].sort();
    if (sorted.length === 1) {
      wizard.push(`import { ${sorted[0]} } from "${pkg}";`);
    } else {
      wizard.push(`import {\n${sorted.map((s) => `  ${s},`).join("\n")}\n} from "${pkg}";`);
    }
  }

  return [...fixed, ...wizard].join("\n") + "\n";
}

function renderPlugins(plugins) {
  if (plugins.length === 0) return "[]";
  const elements = plugins.map((p) => `  ${p.symbol},`).join("\n");
  return `[\n${elements}\n]`;
}

function renderHooks(hooks) {
  if (hooks.length === 0) return "[]";
  const elements = hooks.map((h) => `  ${h.expression},`).join("\n");
  return `[\n${elements}\n]`;
}

function renderConfig(pluginConfig) {
  if (pluginConfig.length === 0) return "{}";
  const entries = pluginConfig
    .map((entry) => `  ${JSON.stringify(entry.key)}: ${entry.expression},`)
    .join("\n");
  return `{\n${entries}\n}`;
}

// Each `expression` should be a valid JavaScript object property and is
// inserted into the generated object verbatim (e.g. `privateKey: \`0x${operatorKey}\``
// or shorthand `network`). Expressions can reference constants declared in
// `shared/config.js`, such as `operatorKey` or `network`.
function renderExtraContext(extraContext) {
  if (extraContext.length === 0) return "{}";
  const entries = extraContext
    .map((entry) => `  ${entry.expression},`)
    .join("\n");
  return `{\n${entries}\n}`;
}
