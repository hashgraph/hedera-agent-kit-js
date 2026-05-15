"use client";

import * as React from "react";

import type { ChatToolPart } from "@/features/chat/types";
import type { TimelineRowViewModel } from "@/features/chat/utils/timeline-row";

import { ChatActivityTimelineRow } from "./ChatActivityTimelineRow";

export type ChatActivityTimelineProps = {
  rows: ReadonlyArray<TimelineRowViewModel>;
  // Underlying tool parts keyed by `toolCallId`. Synthetic rows (no tool part)
  // simply miss the lookup; the row component falls through to its substrate
  // default rendering when no part is supplied.
  partsByToolCallId?: ReadonlyMap<string, ChatToolPart>;
};

// Renders the ordered timeline list. Delegates each row's shell and panel to
// `ChatActivityTimelineRow`. The Hedera (or any) extension's `row` renderer
// is resolved by the row component itself — this component is renderer-blind.
export function ChatActivityTimeline({
  rows,
  partsByToolCallId,
}: ChatActivityTimelineProps) {
  if (rows.length === 0) return null;
  return (
    <ol
      data-slot="agent-activity-timeline"
      className="border-border/60 ml-1 flex flex-col gap-1 border-l pl-3"
    >
      {rows.map((row) => (
        <li key={row.toolCallId}>
          <ChatActivityTimelineRow
            row={row}
            part={partsByToolCallId?.get(row.toolCallId)}
          />
        </li>
      ))}
    </ol>
  );
}
