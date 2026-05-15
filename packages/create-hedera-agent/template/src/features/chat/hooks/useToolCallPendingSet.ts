"use client";

import * as React from "react";

export type ToolCallPendingSet = {
  pendingToolCallIds: ReadonlySet<string>;
  isToolCallPending: (toolCallId: string) => boolean;
  setToolCallPending: (toolCallId: string, pending: boolean) => void;
};

// Tracks the set of tool calls an extension has marked "in flight" (e.g. a
// HITL signing flow between Sign and the submit-signed response). Lifted out
// of `Chat` so the orchestrator can stay tiny; the snapshot is published to
// the message list (for activity highlight) and to extensions via
// `ChatToolActionsContext`.
export function useToolCallPendingSet(): ToolCallPendingSet {
  const [pendingToolCallIds, setPendingToolCallIds] = React.useState<
    Set<string>
  >(() => new Set());

  const setToolCallPending = React.useCallback(
    (toolCallId: string, pending: boolean) => {
      setPendingToolCallIds((prev) => {
        const next = new Set(prev);
        if (pending) next.add(toolCallId);
        else next.delete(toolCallId);
        return next;
      });
    },
    [],
  );

  const isToolCallPending = React.useCallback(
    (toolCallId: string) => pendingToolCallIds.has(toolCallId),
    [pendingToolCallIds],
  );

  return { pendingToolCallIds, isToolCallPending, setToolCallPending };
}
