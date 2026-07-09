// Type definitions for chat extension API.
//
// Stable shape passed to per-tool renderers. Mirrors a single tool part on a
// chat message: tool name, tool call id, input, output, state. Extensions
// derive any tool-specific projection (status badges, transaction ids, etc.)
// from these primitives — the substrate never inspects them.
//
// @typedef {Object} ToolPartProps
// @property {string} toolName
// @property {string} toolCallId
// @property {unknown} input
// @property {unknown} output
// @property {string} state - Wire-level tool part state as emitted by the active runtime.
// @property {string} [errorMessage]
//
// @typedef {Object} ToolRenderer
// @property {React.ComponentType<ToolPartProps>} [card] - Rich inline card rendered in the message stream.
// @property {React.ComponentType<ToolPartProps>} [row] - Compact row rendered inside the activity timeline expand panel.
//
// @typedef {Object} ToolSummaryField
// @property {string} label
// @property {string} value
//
// @typedef {Object} ToolSummary
// @property {string} title
// @property {ToolSummaryField[]} fields
// @property {string} [hashscanPath] - Optional path appended to a network-aware explorer base URL.
//
// @typedef {(input: unknown) => ToolSummary} ToolSummarizer
//
// @typedef {Object} SuggestionChip
// @property {string} id
// @property {string} label - Chip caption.
// @property {string} prompt - Text inserted into the composer on click.
// @property {boolean} [mutating] - Hint that the prompt likely triggers a state-mutating tool.
//
// @typedef {Object} ChatExtension
// @property {string} id - Stable identifier used in collision-warning messages. Unique across the registered extensions array.
// @property {Record<string, ToolRenderer>} [toolRenderers] - Per-tool renderers keyed by tool method name.
// @property {Record<string, ToolSummarizer>} [toolSummarizers] - Per-tool summarizers keyed by tool method name.
// @property {ReadonlyArray<SuggestionChip>} [suggestions] - Concatenated across extensions in registration order.
// @property {string} [systemPrompt] - Joined across extensions with a blank-line separator.
// @property {() => Record<string, unknown>} [getRequestBody] - Returns an opaque key/value bag merged into the outgoing chat-request body.

export {};
