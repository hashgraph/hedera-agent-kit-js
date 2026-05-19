"use client";

import * as React from "react";

import { ChatActivityTimelineRow } from "./ChatActivityTimelineRow";

// Renders the ordered timeline list. Delegates each row's shell and panel to
// `ChatActivityTimelineRow`. The Hedera (or any) extension's `row` renderer
// is resolved by the row component itself — this component is renderer-blind.
export function ChatActivityTimeline({
  rows,
  partsByToolCallId,
}) {
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
