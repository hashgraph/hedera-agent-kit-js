import { AccountId, Client, PrivateKey } from "@hiero-ledger/sdk";
import {
  coreAccountPlugin,
  coreAccountQueryPlugin,
  coreConsensusPlugin,
  coreConsensusQueryPlugin,
  coreEVMPlugin,
  coreEVMQueryPlugin,
  coreMiscQueriesPlugin,
  coreTokenPlugin,
  coreTokenQueryPlugin,
  coreTransactionQueryPlugin,
} from "@hashgraph/hedera-agent-kit/plugins";

// --- Environment ------------------------------------------------------------

const operatorId = requireEnv("HEDERA_OPERATOR_ID");
const operatorKey = requireEnv("HEDERA_OPERATOR_KEY");
const network = (process.env.HEDERA_NETWORK || "testnet").toLowerCase();
if (network !== "testnet" && network !== "mainnet") {
  throw new Error(`HEDERA_NETWORK must be "testnet" or "mainnet" (got "${network}").`);
}

// --- Wiring (edit this file to change the agent's behavior) ----------------

// Plugins available to the agent. Add or remove entries to expose more/less.
export const plugins = [
  coreAccountPlugin,
  coreTokenPlugin,
  coreConsensusPlugin,
  coreEVMPlugin,
  coreAccountQueryPlugin,
  coreTokenQueryPlugin,
  coreConsensusQueryPlugin,
  coreEVMQueryPlugin,
  coreMiscQueriesPlugin,
  coreTransactionQueryPlugin,
];

// "auto" — the server signs and submits with the operator key.
// "human" — the kit returns unsigned bytes; the browser wallet signs them.
// The CLI always runs in "auto"; the web app toggles per conversation.
export const mode = "auto";

// Hooks that apply to every tool call (policies, audit trails, etc.).
// Both the AI SDK and the LangChain runtimes consume this same list.
export const hooks = [];

// Per-plugin runtime configuration. Keys are plugin identifiers; values are
// shapes the individual plugins expect under `context.config`.
export const config = {};

export const systemPrompt = `You are a Hedera Agent assistant. You help users interact with the Hedera network through the Hedera Agent Kit.

## Runtime context

- Operator account: \`${operatorId}\`
- Network: \`${network}\`
- Mode: \`${mode}\`

## Behavior contract

- Never invent account IDs, token IDs, transaction IDs, or contract addresses. If a value is required and you do not have it, ask the user for it.
- Never ask the user to confirm before calling a read-only query tool (balance lookups, account info, transaction history, token info, network info, mirror-node queries). Call the tool immediately and report the result.
- Only ask the user for input that is genuinely missing from the request — e.g. an unspecified recipient account for a transfer. Do not ask for permission to proceed; the HITL gate (when active) is handled by the UI, not by you.
- When a user rejects a transaction, treat it as a clarification opportunity — ask a focused follow-up question. Do not apologize, do not retry the same call.
- When a transaction fails on the network, explain the failure in plain language and suggest a concrete fix. Do not silently retry.
- When a transaction succeeds, confirm it briefly and reference the real transaction ID returned by the tool.

## Mode-specific behavior

- In \`human\` mode every mutating call returns unsigned transaction bytes for the user to sign offline and submit. Frame proposals as actions the user is about to sign and submit themselves.
- When a tool returns \`status: AWAITING_APPROVAL\`, briefly acknowledge that the user needs to sign the transaction externally and stop — do not call any further tools. The conversation resumes automatically once the user submits the signed bytes (or rejects).
- **Never include raw transaction bytes, base64 blobs, or hex payloads in your reply text.** The transaction card already shows them to the user with a Copy button. Your role is to describe the action in plain English, not to mirror machine data.
- When a tool returns \`status: REJECTED\`, treat it the same as a user rejection: ask a focused clarifying question, do not retry, do not apologize.
- In \`auto\` mode the server signs and submits with the operator key. State what you did once it is done.

## Formatting

- Markdown is the only accepted output format. Never emit LaTeX, MathML, HTML, XML, BBCode, or any other markup.
- Render numeric calculations as plain prose or as a markdown list.
- Wrap account IDs, token IDs, transaction IDs, and EVM addresses in backticks.
- Use fenced code blocks for multi-line snippets.
`;

// --- Derived runtime objects ------------------------------------------------

// Hedera SDK client bound to the operator key. Consumed by both CLI runtimes
// when constructing their toolkits. The web app builds its own per-request
// clients (auto-mode signing vs return-bytes for human-in-the-loop signing)
// and does not import this export.
export const client = createClient();

// --- Helpers ----------------------------------------------------------------

function requireEnv(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(
      `${name} is required. Set it in your .env file before starting the app.`,
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
