// Lightweight summarizer fixtures used by the substrate tests so they exercise
// the registry-lookup path without importing from any tool-family extension.
// The titles and field shapes match a representative external extension so the
// expected strings in tests describe real-world output rather than the
// substrate default.
export const fixtureToolSummarizers = {
  transfer_hbar_tool: (input) => {
    const params = asRecord(input);
    const transfers = asArray(params.transfers);
    const sender = asString(params.sourceAccountId);
    const lines = transfers.length
      ? transfers.map((entry) => {
          const t = asRecord(entry);
          const recipient = asString(t.accountId) ?? "unknown";
          const amount = asString(t.amount) ?? "?";
          return `${amount} ℏ → ${recipient}`;
        })
      : ["(no transfers specified)"];
    const fields = [];
    if (sender) fields.push({ label: "From", value: sender });
    fields.push({ label: "Transfers", value: lines.join("\n") });
    return { title: "Transfer HBAR", fields };
  },
  create_fungible_token_tool: (input) => {
    const params = asRecord(input);
    const name = asString(params.tokenName) ?? "(unnamed)";
    return {
      title: "Create fungible token",
      fields: [{ label: "Name", value: name }],
    };
  },
};

function asRecord(value) {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value;
  }
  return {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asString(value) {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return undefined;
}
