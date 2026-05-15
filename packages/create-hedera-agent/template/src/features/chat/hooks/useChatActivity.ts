"use client";

import { useChatExtension } from "@/features/chat/extension";
import { isChatToolPart, type ChatToolPart } from "@/features/chat/types";
import {
  deriveActivity,
  type ActivityInput,
  type ActivityViewModel,
} from "@/features/chat/utils/agent-activity";
import {
  mapTimelineRows,
  type TimelineRowViewModel,
} from "@/features/chat/utils/timeline-row";

export type UseChatActivityOptions = {
  input: ActivityInput;
  // Server-derived set of mutating tool methods, forwarded so the timeline row
  // mapper can minimize the panel for tools whose inline card already carries
  // the rich rendering. Read-only tools omit the prop.
  mutatingToolMethods?: ReadonlySet<string>;
};

export type ChatActivityModel = {
  view: ActivityViewModel;
  rows: TimelineRowViewModel[];
  // Lookup keyed by `row.toolCallId`. Carries the underlying `ChatToolPart` so
  // the timeline row component can pass canonical `ToolPartProps` to an
  // extension-registered renderer. Synthetic rows (e.g. the whole-turn error)
  // have no entry here.
  partsByToolCallId: ReadonlyMap<string, ChatToolPart>;
};

// Derives the agent-activity view model plus the per-tool timeline rows in one
// pass, sourcing per-tool summarizers from the merged extension registry.
// Keeps the indicator/timeline components free of any deriver wiring and lets
// substrate tests inject fixtures via the registry without touching the hook.
export function useChatActivity({
  input,
  mutatingToolMethods,
}: UseChatActivityOptions): ChatActivityModel {
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
  const partsByToolCallId = new Map<string, ChatToolPart>();
  for (const part of input.message.parts) {
    if (!isChatToolPart(part)) continue;
    partsByToolCallId.set(part.toolCallId, part);
  }
  return { view, rows, partsByToolCallId };
}

const EMPTY_ROWS: TimelineRowViewModel[] = [];
const EMPTY_PARTS: ReadonlyMap<string, ChatToolPart> = new Map();
