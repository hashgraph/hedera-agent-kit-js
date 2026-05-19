// Per-tool input formatters. Each entry maps a Hedera Agent Kit tool method
// name to a function that turns the tool's raw input into a `ToolSummary` the
// substrate / cards can render. The chat substrate's default summarizer covers
// any unregistered tool, so this registry only needs to surface the per-tool
// projections that improve on the humanized fallback.

import { humanizeKey, humanizeToolName } from "@/features/chat/utils/humanize";

const transferHbarSummary = (input) => {
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
  if (params.transactionMemo) {
    fields.push({ label: "Memo", value: String(params.transactionMemo) });
  }

  return { title: "Transfer HBAR", fields };
};

const createFungibleTokenSummary = (input) => {
  const params = asRecord(input);
  const name = asString(params.tokenName) ?? "(unnamed)";
  const symbol = asString(params.tokenSymbol);
  const fields = [{ label: "Name", value: name }];
  if (symbol) fields.push({ label: "Symbol", value: symbol });
  if (params.initialSupply !== undefined) {
    fields.push({
      label: "Initial supply",
      value: String(params.initialSupply),
    });
  }
  if (params.decimals !== undefined) {
    fields.push({ label: "Decimals", value: String(params.decimals) });
  }
  if (params.supplyType) {
    fields.push({ label: "Supply type", value: String(params.supplyType) });
  }
  if (params.maxSupply !== undefined) {
    fields.push({ label: "Max supply", value: String(params.maxSupply) });
  }
  if (params.treasuryAccountId) {
    fields.push({
      label: "Treasury",
      value: String(params.treasuryAccountId),
    });
  }
  return { title: "Create fungible token", fields };
};

const mintFungibleTokenSummary = (input) => {
  const params = asRecord(input);
  const tokenId = asString(params.tokenId) ?? "(unknown)";
  const amount = asString(params.amount) ?? "?";
  return {
    title: "Mint tokens",
    fields: [
      { label: "Token", value: tokenId },
      { label: "Amount", value: amount },
    ],
  };
};

const associateTokenSummary = (input) => {
  const params = asRecord(input);
  const tokens = asArray(params.tokenIds).map(asString).filter(isNonEmpty);
  const account = asString(params.accountId);
  const fields = [];
  if (account) fields.push({ label: "Account", value: account });
  fields.push({
    label: "Tokens",
    value: tokens.length ? tokens.join(", ") : "(none)",
  });
  return { title: "Associate tokens", fields };
};

const submitTopicMessageSummary = (input) => {
  const params = asRecord(input);
  const topicId = asString(params.topicId) ?? "(unknown)";
  const message = asString(params.message) ?? "";
  return {
    title: "Submit topic message",
    fields: [
      { label: "Topic", value: topicId },
      { label: "Message", value: truncate(message, 240) },
    ],
  };
};

const createTopicSummary = (input) => {
  const params = asRecord(input);
  const memo = asString(params.topicMemo);
  const fields = [];
  if (memo) fields.push({ label: "Memo", value: memo });
  if (params.isSubmitKey !== undefined) {
    fields.push({ label: "Submit key", value: String(params.isSubmitKey) });
  }
  return {
    title: "Create topic",
    fields: fields.length ? fields : [{ label: "Options", value: "defaults" }],
  };
};

const transferNonFungibleTokenSummary = (input) => {
  const params = asRecord(input);
  const tokenId = asString(params.tokenId) ?? "(unknown)";
  const recipients = asArray(params.recipients).map((r) => {
    const rec = asRecord(r);
    return `#${asString(rec.serialNumber) ?? "?"} → ${
      asString(rec.recipientId) ?? "unknown"
    }`;
  });
  return {
    title: "Transfer NFT",
    fields: [
      { label: "Token", value: tokenId },
      {
        label: "Transfers",
        value: recipients.length ? recipients.join("\n") : "(none)",
      },
    ],
  };
};

// Registry. Add entries here as new tools warrant Hedera-specific formatting;
// everything else falls through to the substrate's default humanized summary.
export const transactionSummaries = {
  transfer_hbar_tool: transferHbarSummary,
  create_fungible_token_tool: createFungibleTokenSummary,
  mint_fungible_token_tool: mintFungibleTokenSummary,
  associate_token_tool: associateTokenSummary,
  submit_topic_message_tool: submitTopicMessageSummary,
  create_topic_tool: createTopicSummary,
  transfer_non_fungible_token_tool: transferNonFungibleTokenSummary,
};

// Convenience for call sites (the card, hooks) that want a single formatter
// signature: look up the registry; fall through to the substrate's humanized
// fallback when the tool isn't registered. Mirrors the contract the substrate
// uses internally.
export function summarize(toolName, input) {
  const formatter = transactionSummaries[toolName];
  if (formatter) {
    try {
      return formatter(input);
    } catch {
      // Fall through to the default below.
    }
  }
  return defaultSummary(toolName, input);
}

function defaultSummary(toolName, input) {
  const title = humanizeToolName(toolName);
  const record = isPlainRecord(input) ? input : null;
  if (!record) {
    return {
      title,
      fields: [{ label: "Input", value: stringifyInput(input) }],
    };
  }
  const fields = Object.entries(record).map(([key, value]) => ({
    label: humanizeKey(key),
    value: stringifyValue(value),
  }));
  return {
    title,
    fields: fields.length ? fields : [{ label: "Input", value: "(none)" }],
  };
}

// Re-export the generic humanize helpers under their historical names so any
// remaining Hedera-side caller stays self-contained without reaching into the
// substrate. The implementations live in the chat substrate.
export { humanizeKey, humanizeToolName } from "@/features/chat/utils/humanize";

function stringifyValue(value) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return stringifyInput(value);
}

function stringifyInput(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function truncate(text, max) {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function asRecord(value) {
  return isPlainRecord(value) ? value : {};
}

function isPlainRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asString(value) {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return undefined;
}

function isNonEmpty(value) {
  return value !== undefined && value !== null && value !== "";
}
