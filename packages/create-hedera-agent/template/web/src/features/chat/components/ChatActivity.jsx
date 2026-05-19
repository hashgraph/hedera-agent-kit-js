"use client";

import * as React from "react";

import { useChatActivity } from "@/features/chat/hooks/useChatActivity";

import { ChatActivityIndicator } from "./ChatActivityIndicator";
import { ChatActivityTimeline } from "./ChatActivityTimeline";

// Approximate window the indicator dwells on the "Stopped" label after a
// cancellation before committing to the resting chip. Long enough for the
// acknowledgement to register, short enough not to obstruct the next turn.
const STOPPED_HOLD_MS = 1000;

// Sentinel toolCallId for the synthetic whole-turn error row. Unique among
// real tool call IDs; the row component short-circuits this state into an
// inline error rendering (no chevron, no expand panel).
const SYNTHETIC_AGENT_ERROR_ID = "__synthetic_agent_error";

// Thin orchestrator: derives the activity model, manages the brief "Stopped"
// hold lifecycle, and composes the indicator + (optional) timeline. All
// per-variant rendering lives in `ChatActivityIndicator`; per-row rendering
// lives in `ChatActivityTimelineRow`.
export function ChatActivity({ input, mutatingToolMethods }) {
  const { view, rows, partsByToolCallId } = useChatActivity({
    input,
    mutatingToolMethods,
  });
  const stoppedHold = useStoppedHold(view);
  const [open, setOpen] = React.useState(false);
  const onToggle = React.useCallback(() => setOpen((v) => !v), []);

  if (view.kind === "hidden") return null;
  if (view.kind === "wait") return <ChatActivityIndicator kind="wait" />;
  if (stoppedHold) return <ChatActivityIndicator kind="stopped" />;

  if (view.kind === "progress") {
    const expandable = rows.length > 0;
    return (
      <div className="flex flex-col gap-2">
        <ChatActivityIndicator
          kind="progress"
          label={view.label}
          expandable={expandable}
          open={open}
          onToggle={onToggle}
        />
        {open && expandable ? (
          <ChatActivityTimeline rows={rows} partsByToolCallId={partsByToolCallId} />
        ) : null}
      </div>
    );
  }

  // Resting / resting-failed. The synthetic agent-error row inflates the
  // timeline so the chip stays meaningful even on a zero-tool failure.
  const failed = view.kind === "resting-failed";
  if (view.stepCount === 0 && !failed) return null;
  const finalRows = failed
    ? [...rows, syntheticAgentErrorRow(view.errorMessage)]
    : rows;

  return (
    <div className="flex flex-col gap-2" data-failed={failed || undefined}>
      <ChatActivityIndicator
        kind="resting"
        stepCount={view.stepCount}
        failed={failed}
        open={open}
        onToggle={onToggle}
      />
      {open ? (
        <ChatActivityTimeline rows={finalRows} partsByToolCallId={partsByToolCallId} />
      ) : null}
    </div>
  );
}

// Lifecycle-aware label hold for cancellation. Only flashes "Stopped" when the
// view transitions from `progress` to `resting`+cancelled — not on first mount
// of an already-cancelled past turn after a reload.
function useStoppedHold(view) {
  const prevKindRef = React.useRef(view.kind);
  const [showStoppedHold, setShowStoppedHold] = React.useState(false);
  const cancelled = view.kind === "resting" && view.cancelled === true;
  React.useEffect(() => {
    const prevKind = prevKindRef.current;
    prevKindRef.current = view.kind;
    if (prevKind === "progress" && view.kind === "resting" && cancelled) {
      setShowStoppedHold(true);
      const timer = setTimeout(() => setShowStoppedHold(false), STOPPED_HOLD_MS);
      return () => clearTimeout(timer);
    }
  }, [view.kind, cancelled]);
  return showStoppedHold;
}

function syntheticAgentErrorRow(errorMessage) {
  return {
    toolCallId: SYNTHETIC_AGENT_ERROR_ID,
    toolName: "__agent_error",
    state: "agent-error",
    label: "Agent error",
    inputFields: [],
    outputFields: [],
    errorMessage,
  };
}
