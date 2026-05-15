import type * as React from "react";

// Stable shape passed to per-tool renderers. Mirrors a single tool part on a
// chat message: tool name, tool call id, input, output, state. Extensions
// derive any tool-specific projection (status badges, transaction ids, etc.)
// from these primitives — the substrate never inspects them.
export type ToolPartProps = {
  toolName: string;
  toolCallId: string;
  input: unknown;
  output: unknown;
  // Wire-level tool part state as emitted by the active runtime. Substrate
  // doesn't enumerate the values; extensions pattern-match on their own.
  state: string;
  errorMessage?: string;
};

export type ToolRenderer = {
  // Rich inline card rendered in the message stream. The card is responsible
  // for its own approval / action affordances; the substrate just routes the
  // tool part to it.
  card?: React.ComponentType<ToolPartProps>;
  // Compact row rendered inside the activity timeline expand panel. Optional;
  // the substrate renders a generic input/output projection when absent.
  row?: React.ComponentType<ToolPartProps>;
};

export type ToolSummaryField = {
  label: string;
  value: string;
};

export type ToolSummary = {
  title: string;
  fields: ToolSummaryField[];
  // Optional path appended to a network-aware explorer base URL. Renderers
  // that care interpret this; the substrate passes it through unchanged.
  hashscanPath?: string;
};

export type ToolSummarizer = (input: unknown) => ToolSummary;

// Single suggestion chip shown in the empty state. `prompt` is the text
// inserted into the composer on click; `label` is the chip caption.
export type SuggestionChip = {
  id: string;
  label: string;
  prompt: string;
  // Hint that the prompt likely triggers a state-mutating tool. Extensions
  // populate this to drive a "Requires approval" affordance once mode lives
  // in the relevant context.
  mutating?: boolean;
};

// One registration unit. Every slot is optional so an extension can target a
// single concern (e.g. only suggestions, only a system prompt).
export type ChatExtension = {
  // Stable identifier used in collision-warning messages. Should be unique
  // across the registered extensions array.
  id: string;
  // Per-tool renderers keyed by tool method name. Card and row are merged
  // independently; collisions warn in development.
  toolRenderers?: Record<string, ToolRenderer>;
  // Per-tool summarizers keyed by tool method name. Drives the activity
  // timeline label and any caller that needs an input-shaped summary.
  toolSummarizers?: Record<string, ToolSummarizer>;
  // Concatenated across extensions in registration order.
  suggestions?: ReadonlyArray<SuggestionChip>;
  // Joined across extensions with a blank-line separator. Substrate consumes
  // this verbatim when composing the request to the runtime.
  systemPrompt?: string;
  // Returns an opaque key/value bag merged into the outgoing chat-request body
  // via `Object.assign`. Substrate doesn't inspect the keys.
  getRequestBody?: () => Record<string, unknown>;
};
