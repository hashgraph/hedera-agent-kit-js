import {
  isChatToolPart,
} from "@/features/chat/types";
import { defaultSummarize } from "./default-summarizer";

// Input discriminator. `pending` covers the brief window between submit and the
// first assistant message; `message` covers the per-assistant-message indicator
// (live or past). `isLive` is true only for the in-flight turn — past messages
// always resolve to `resting` (or `hidden` when they ran zero tools).
//
// `signingToolCallIds` is only read by the component (forwarded into the
// timeline-row mapper), not by `deriveActivity` itself — the indicator state
// is independent of the per-tool signing flag.
//
// @typedef {Object} ActivityInputPending
// @property {"pending"} kind
// @property {string} status
//
// @typedef {Object} ActivityInputMessage
// @property {"message"} kind
// @property {import("@/features/chat/types").ChatMessage} message
// @property {boolean} isLive
// @property {string} status
// @property {Error | null} [error]
// @property {ReadonlySet<string>} [signingToolCallIds]
//
// @typedef {ActivityInputPending | ActivityInputMessage} ActivityInput

// Discriminated view model. `hidden` is the explicit no-render case so the
// component renders without conditional logic over step counts or status —
// it switches on `kind` and projects each variant directly. `cancelled` on
// `resting` is a hint to the indicator that the live turn was stopped mid-
// stream — used to drive the brief "Stopped" label hold and to flip stuck
// tool rows to the `stopped` icon. The chip itself stays `▸ N steps`.

export function deriveActivity(
  input,
  options = {},
) {
  if (input.kind === "pending") {
    return input.status === "submitted" ? { kind: "wait" } : { kind: "hidden" };
  }

  const stepCount = countToolParts(input.message);
  const isStreaming =
    input.isLive && (input.status === "submitted" || input.status === "streaming");

  if (isStreaming) {
    return {
      kind: "progress",
      label: resolveProgressLabel(input.message, options.toolSummarizers),
      stepCount,
    };
  }

  if (input.isLive && input.status === "error" && input.error) {
    return {
      kind: "resting-failed",
      stepCount,
      errorMessage: input.error.message || "Agent error",
    };
  }

  // Cancellation: status returned to `ready` while a tool is still mid-call
  // or final text never finished streaming. The HITL `awaiting-approval`
  // pause is excluded because that part is in `output-available` (with the
  // sentinel status) — the user can still approve/reject after a Stop click,
  // so we don't want to flip the timeline into a confusing intermediate.
  if (input.isLive && hasUnfinishedParts(input.message)) {
    return { kind: "resting", stepCount, cancelled: true };
  }

  if (stepCount === 0) {
    return { kind: "hidden" };
  }
  return { kind: "resting", stepCount };
}

function countToolParts(message) {
  return message.parts.filter(isChatToolPart).length;
}

// True when the message contains a tool part that never reached a terminal
// `output-*` state, or a text part that's still marked as streaming. Either
// signals the user clicked Stop while the agent was mid-step.
export function hasUnfinishedParts(message) {
  return message.parts.some((part) => {
    if (isChatToolPart(part)) {
      return (
        part.state === "input-streaming" ||
        part.state === "input-available" ||
        part.state === "approval-requested" ||
        part.state === "approval-responded"
      );
    }
    if (part.type === "text") {
      return part.state === "streaming";
    }
    return false;
  });
}

function resolveProgressLabel(
  message,
  summarizers,
) {
  const parts = message.parts;
  const lastPart = parts[parts.length - 1];

  // Text is streaming. If tools have already run in this turn, this is the
  // final reply text — "Writing response…". If no tools have run, the model is
  // still producing exploratory text and could yet call a tool — "Thinking…".
  if (lastPart?.type === "text" && lastPart.state === "streaming") {
    const hasToolPart = parts.some(isChatToolPart);
    return hasToolPart ? "Writing response…" : "Thinking…";
  }

  // Active tool: the last part is a tool call whose input is streaming in or
  // is fully available but not yet executed. Source the label from the
  // injected summarizer registry (with humanized-name fallback) and append the
  // ellipsis at the indicator level.
  if (
    lastPart &&
    isChatToolPart(lastPart) &&
    (lastPart.state === "input-streaming" || lastPart.state === "input-available")
  ) {
    const summary = summarizeFor(summarizers, lastPart);
    return `${summary.title}…`;
  }

  return "Thinking…";
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
      // Fall through to substrate default — a malformed input never breaks UI.
    }
  }
  return defaultSummarize(part.toolName, part.input);
}
