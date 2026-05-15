import type { ToolSummarizer, ToolSummary } from "@/features/chat/extension";
import {
  isChatToolPart,
  type ChatMessage,
  type ChatToolPart,
} from "@/features/chat/types";
import { defaultSummarize } from "./default-summarizer";
import { humanizeKey } from "./humanize";

// Discriminated row state. `pending` covers every pre-output phase including
// the HITL signing window (which overrides `awaiting-approval` so the row
// reads as in-flight while the wallet roundtrips). `failure`, `rejected`, and
// `network-error` are kept distinct so each gets its own icon and copy.
// `stopped` marks rows whose tool call was still in flight when the user
// clicked Stop — the timeline row freezes with the matching icon. `agent-
// error` is reserved for the synthetic whole-turn error row appended by the
// AgentActivity component when `useChat`'s error reference is set; no real
// tool part ever maps to it.
export type TimelineRowState =
  | "pending"
  | "success"
  | "failure"
  | "rejected"
  | "network-error"
  | "awaiting-approval"
  | "stopped"
  | "agent-error";

export type TimelineRowField = { label: string; value: string };

export type TimelineRowViewModel = {
  toolCallId: string;
  toolName: string;
  state: TimelineRowState;
  label: string;
  // Optional one-line summary chip rendered inline next to the label. Reserved
  // for cases where a single token of result (e.g. a wire status code on
  // failure) fits cleanly without competing with the row label.
  chip?: string;
  inputFields: TimelineRowField[];
  outputFields: TimelineRowField[];
  transactionId?: string;
  hashscanPath?: string;
  errorMessage?: string;
};

export type TimelineRowInput = {
  part: ChatToolPart;
  signing?: boolean;
  // When true, the row's expanded panel is kept minimal — tx ID + status badge
  // only — because the mutating tool's inline card carries the rich input /
  // output rendering. Read-only tools never set this; their timeline row is
  // their full audit footprint.
  isMutating?: boolean;
  // True when the parent turn was cancelled — flips any pending part to the
  // `stopped` state so the row reads as frozen rather than perpetually loading.
  cancelled?: boolean;
  // Optional per-tool summarizer registry, injected from the merged
  // ChatExtension registry. Falls back to substrate default per tool.
  toolSummarizers?: Readonly<Record<string, ToolSummarizer>>;
};

// Wire-level sentinels emitted by the agent's tool envelope. These are wire
// constants, not code dependencies — they're part of the JSON contract the
// server sends back, so duplicating the string here keeps the substrate free
// of server-side imports.
const AWAITING_APPROVAL_STATUS = "AWAITING_APPROVAL";
const REJECTED_STATUS = "REJECTED";
const SUCCESS_STATUSES = new Set(["SUCCESS", "OK"]);

export function mapTimelineRow(input: TimelineRowInput): TimelineRowViewModel {
  const { part, signing = false, cancelled = false, toolSummarizers } = input;
  const summary = summarizeFor(toolSummarizers, part);
  const outcome = extractOutcome(part);
  const state = mapRowState(part, outcome, signing, cancelled);

  return {
    toolCallId: part.toolCallId,
    toolName: part.toolName,
    state,
    label: summary.title,
    chip: deriveChip(state, outcome),
    // Input, output, error, and tx ID are all rendered for every tool so the
    // row's expand panel is a self-sufficient audit affordance — including
    // for mutating tools whose inline card only renders the headline status.
    // Some duplication with the card on confirmed mutating tools is the
    // accepted trade-off for full per-row inspectability.
    inputFields: summary.fields,
    outputFields: projectOutputFields(part),
    transactionId: outcome.transactionId,
    hashscanPath: summary.hashscanPath,
    errorMessage: outcome.errorMessage,
  };
}

export type MapTimelineRowsOptions = {
  signingToolCallIds?: ReadonlySet<string>;
  mutatingToolMethods?: ReadonlySet<string>;
  cancelled?: boolean;
  toolSummarizers?: Readonly<Record<string, ToolSummarizer>>;
};

export function mapTimelineRows(
  message: ChatMessage,
  options: MapTimelineRowsOptions = {},
): TimelineRowViewModel[] {
  const { signingToolCallIds, mutatingToolMethods, cancelled, toolSummarizers } =
    options;
  const rows: TimelineRowViewModel[] = [];
  for (const part of message.parts) {
    if (!isChatToolPart(part)) continue;
    rows.push(
      mapTimelineRow({
        part,
        signing: signingToolCallIds?.has(part.toolCallId) ?? false,
        isMutating: mutatingToolMethods?.has(part.toolName) ?? false,
        cancelled: cancelled ?? false,
        toolSummarizers,
      }),
    );
  }
  return rows;
}

type Outcome = {
  status?: string;
  transactionId?: string;
  humanMessage?: string;
  errorMessage?: string;
  raw?: Record<string, unknown>;
};

function mapRowState(
  part: ChatToolPart,
  outcome: Outcome,
  signing: boolean,
  cancelled: boolean,
): TimelineRowState {
  switch (part.state) {
    case "input-streaming":
    case "input-available":
    case "approval-requested":
    case "approval-responded":
      // The signing flag overrides cancellation: if the wallet is mid-roundtrip
      // we keep the row in `pending` so the ongoing signature isn't visually
      // lied about. Without an active sign, a non-terminal part on a cancelled
      // turn freezes as `stopped` rather than spinning forever.
      if (signing) return "pending";
      return cancelled ? "stopped" : "pending";
    case "output-available":
      if (outcome.status === AWAITING_APPROVAL_STATUS) {
        // HITL pause is a legitimate steady state — even after Stop the user
        // can still approve or reject. Cancellation must not leave the timeline
        // in a confusing intermediate state.
        return signing ? "pending" : "awaiting-approval";
      }
      if (outcome.status === REJECTED_STATUS) return "rejected";
      if (isFailureStatus(outcome.status)) return "failure";
      return "success";
    case "output-error":
      return "network-error";
    default:
      return cancelled ? "stopped" : "pending";
  }
}

function deriveChip(state: TimelineRowState, outcome: Outcome): string | undefined {
  if (state === "failure" && outcome.status) return outcome.status;
  return undefined;
}

function extractOutcome(part: ChatToolPart): Outcome {
  if (part.state === "output-error") {
    return { errorMessage: part.errorText };
  }
  if (part.state !== "output-available") {
    return {};
  }
  const parsed = parseToolOutput(part.output);
  if (!parsed) return {};
  const raw = isRecord(parsed.raw) ? parsed.raw : undefined;
  const status = resolveStatus(raw);
  const transactionId =
    typeof raw?.transactionId === "string" ? raw.transactionId : undefined;
  const humanMessage =
    typeof parsed.humanMessage === "string" ? parsed.humanMessage : undefined;
  const errorMessage = isFailureStatus(status) ? humanMessage : undefined;
  return { status, transactionId, humanMessage, errorMessage, raw };
}

// SDK Status is a frozen class instance that JSON-serializes as `{ "_code":
// <n> }`, so `raw.status` can arrive as an object, not a string — a strict
// `typeof === "string"` check loses the failure signal and the row would
// render as confirmed. Treat the presence of `raw.error` as the canonical
// failure marker that pairs with that envelope.
function resolveStatus(
  raw: Record<string, unknown> | undefined,
): string | undefined {
  if (!raw) return undefined;
  if (typeof raw.status === "string") return raw.status;
  if (typeof raw.error === "string" && raw.error.length > 0) return "FAILED";
  return undefined;
}

function projectOutputFields(part: ChatToolPart): TimelineRowField[] {
  if (part.state === "output-error") {
    return part.errorText ? [{ label: "Error", value: part.errorText }] : [];
  }
  if (part.state !== "output-available") return [];

  const parsed = parseToolOutput(part.output);
  if (!parsed) {
    if (part.output === undefined || part.output === null) return [];
    const raw =
      typeof part.output === "string" ? part.output : stringify(part.output);
    return [{ label: "Output", value: raw }];
  }

  const fields: TimelineRowField[] = [];
  if (isRecord(parsed.raw)) {
    for (const [key, value] of Object.entries(parsed.raw)) {
      // tx ID has a dedicated row (with explorer link) — skip the duplicate.
      if (key === "transactionId") continue;
      // Skip absent values so the panel doesn't render columns of em-dashes
      // for fields the tool didn't populate.
      if (!hasMeaningfulValue(value)) continue;
      fields.push({ label: humanizeKey(key), value: stringifyValue(value) });
    }
  }
  if (typeof parsed.humanMessage === "string" && parsed.humanMessage.length > 0) {
    fields.push({ label: "Message", value: parsed.humanMessage });
  }
  return fields;
}

function summarizeFor(
  summarizers: Readonly<Record<string, ToolSummarizer>> | undefined,
  part: ChatToolPart,
): ToolSummary {
  const formatter = summarizers?.[part.toolName];
  if (formatter) {
    try {
      return formatter(part.input);
    } catch {
      // Fall through to substrate default.
    }
  }
  return defaultSummarize(part.toolName, part.input);
}

function hasMeaningfulValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (isRecord(value)) return Object.keys(value).length > 0;
  return true;
}

function parseToolOutput(
  output: unknown,
): { raw?: unknown; humanMessage?: unknown } | null {
  if (typeof output === "string") {
    try {
      const parsed = JSON.parse(output);
      return isRecord(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  if (isRecord(output)) return output;
  return null;
}

function isFailureStatus(status: string | undefined): boolean {
  if (!status) return false;
  if (status === AWAITING_APPROVAL_STATUS) return false;
  if (status === REJECTED_STATUS) return false;
  return !SUCCESS_STATUSES.has(status);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return stringify(value);
}

function stringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
