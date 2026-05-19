import {
  isChatToolPart,
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

// Wire-level sentinels emitted by the agent's tool envelope. These are wire
// constants, not code dependencies — they're part of the JSON contract the
// server sends back, so duplicating the string here keeps the substrate free
// of server-side imports.
const AWAITING_APPROVAL_STATUS = "AWAITING_APPROVAL";
const REJECTED_STATUS = "REJECTED";
const SUCCESS_STATUSES = new Set(["SUCCESS", "OK"]);

export function mapTimelineRow(input) {
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

export function mapTimelineRows(
  message,
  options = {},
) {
  const { signingToolCallIds, mutatingToolMethods, cancelled, toolSummarizers } =
    options;
  const rows = [];
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

function mapRowState(
  part,
  outcome,
  signing,
  cancelled,
) {
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

function deriveChip(state, outcome) {
  if (state === "failure" && outcome.status) return outcome.status;
  return undefined;
}

function extractOutcome(part) {
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
function resolveStatus(raw) {
  if (!raw) return undefined;
  if (typeof raw.status === "string") return raw.status;
  if (typeof raw.error === "string" && raw.error.length > 0) return "FAILED";
  return undefined;
}

function projectOutputFields(part) {
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

  const fields = [];
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
  summarizers,
  part,
) {
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

function hasMeaningfulValue(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (isRecord(value)) return Object.keys(value).length > 0;
  return true;
}

function parseToolOutput(output) {
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

function isFailureStatus(status) {
  if (!status) return false;
  if (status === AWAITING_APPROVAL_STATUS) return false;
  if (status === REJECTED_STATUS) return false;
  return !SUCCESS_STATUSES.has(status);
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringifyValue(value) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return stringify(value);
}

function stringify(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
