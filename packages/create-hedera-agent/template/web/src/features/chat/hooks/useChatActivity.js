"use client";

import { useChatExtension } from "@/features/chat/extension";
import { isChatToolPart } from "@/features/chat/types";
import { deriveActivity } from "@/features/chat/utils/agent-activity";
import { mapTimelineRows } from "@/features/chat/utils/timeline-row";

// Derives the agent-activity view model plus the per-tool timeline rows in one
// pass, sourcing per-tool summarizers from the merged extension registry.
// Keeps the indicator/timeline components free of any deriver wiring and lets
// substrate tests inject fixtures via the registry without touching the hook.
export function useChatActivity({
  input,
  mutatingToolMethods,
}) {
  const { toolSummarizers } = useChatExtension();
  const view = deriveActivity(input, { toolSummarizers });
  // The cancellation flag flows from the activity model into the row mapper so
  // any pending tool part on a stopped turn freezes as `stopped` rather than
  // spinning forever. Same flag drives the brief "Stopped" label hold in
  // `ChatActivity`.
  const cancelled = view.kind === "resting" && view.cancelled === true;
  if (input.kind !== "message") {
    return { view, rows: EMPTY_ROWS, partsByToolCallId: EMPTY_PARTS };
  }
  const rows = mapTimelineRows(input.message, {
    signingToolCallIds: input.signingToolCallIds,
    mutatingToolMethods,
    cancelled,
    toolSummarizers,
  });
  const partsByToolCallId = new Map();
  for (const part of input.message.parts) {
    if (!isChatToolPart(part)) continue;
    partsByToolCallId.set(part.toolCallId, part);
  }
  return { view, rows, partsByToolCallId };
}

const EMPTY_ROWS = [];
const EMPTY_PARTS = new Map();
