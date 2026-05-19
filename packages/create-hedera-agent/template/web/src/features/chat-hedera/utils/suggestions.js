// Hand-curated suggestion chips rendered in the empty-state. Six entries cover
// the major Hedera surfaces the agent can drive. AgentLab and the CLI can
// substitute this array wholesale; consumers should not assume any particular
// chip exists at a particular index.
//
// Each chip carries a `mutating` flag so the UI can show a "requires approval"
// badge in `human` mode without re-deriving the mutability of the underlying
// tool. The flag matches what `getMutatingToolMethods` would report for the
// tool the prompt is most likely to trigger.

export const suggestions = [
  {
    id: "account-balance",
    category: "account-query",
    label: "Check account balance",
    prompt: "Show me the HBAR balance and token holdings for account 0.0.1234.",
    mutating: false,
  },
  {
    id: "token-info",
    category: "token-query",
    label: "Look up a token",
    prompt: "Show me the supply, treasury, and key info for token 0.0.<TOKEN_ID>.",
    mutating: false,
  },
  {
    id: "create-fungible-token",
    category: "token-create",
    label: "Create a fungible token",
    prompt:
      'Create a fungible token named "Demo Token" with symbol "DEMO", 2 decimals, and an initial supply of 1000.',
    mutating: true,
  },
  {
    id: "transfer-hbar",
    category: "hbar-transfer",
    label: "Send HBAR",
    prompt: "Transfer 1 HBAR from my operator account to 0.0.1234.",
    mutating: true,
  },
  {
    id: "submit-topic-message",
    category: "consensus-submit",
    label: "Submit a topic message",
    prompt: 'Submit the message "hello from my agent" to consensus topic 0.0.<TOPIC_ID>.',
    mutating: true,
  },
  {
    id: "transaction-history",
    category: "transaction-history",
    label: "Recent transactions",
    prompt: "Show me the most recent transactions for account 0.0.1234.",
    mutating: false,
  },
];
