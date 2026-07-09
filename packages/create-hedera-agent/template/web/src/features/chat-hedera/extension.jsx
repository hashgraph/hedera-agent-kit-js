import { ChatHederaActivityRow } from "./components/ChatHederaActivityRow";
import { ChatHederaToolCard } from "./components/ChatHederaToolCard";
import { getMode } from "./state/mode-store";
import { suggestions } from "./utils/suggestions";
import { transactionSummaries } from "./utils/transaction-summaries";

// Card + row renderers reused for every Hedera mutating tool. The card short-
// circuits to `null` for tools the server hasn't classified as mutating, so
// registering it for unknown tool names is a no-op, but we keep the registry
// scoped to known mutating method names so collision warnings stay meaningful.
// The row renderer produces the timeline expand panel content (input, output,
// Tx ID, Hashscan link) for the same tool set, keeping Hashscan link rendering
// out of the chat substrate.
const HEDERA_MUTATING_TOOL_METHODS = [
  "transfer_hbar_tool",
  "create_fungible_token_tool",
  "mint_fungible_token_tool",
  "associate_token_tool",
  "submit_topic_message_tool",
  "create_topic_tool",
  "transfer_non_fungible_token_tool",
];

const renderer = {
  card: ChatHederaToolCard,
  row: ChatHederaActivityRow,
};

function buildToolRenderers() {
  const map = {};
  for (const method of HEDERA_MUTATING_TOOL_METHODS) {
    map[method] = renderer;
  }
  return map;
}

// Sole Hedera extension registered with the substrate's ChatExtensionProvider.
// `getRequestBody` contributes the current mode value to every outgoing chat
// request, read from the module-level mode store so the AI SDK's
// auto-resubmit-after-tool-completion always observes the freshest user
// selection. Header components (mode toggle, network badge, wallet button)
// are composed in the app layer, not contributed via the extension.
export const hederaExtension = {
  id: "hedera",
  toolRenderers: buildToolRenderers(),
  toolSummarizers: transactionSummaries,
  suggestions,
  getRequestBody: () => ({ mode: getMode() }),
};
