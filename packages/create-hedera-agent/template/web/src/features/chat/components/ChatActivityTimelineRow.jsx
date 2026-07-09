"use client";

import * as React from "react";
import { ChevronRight } from "lucide-react";

import {
  useChatExtension,
} from "@/features/chat/extension";
import { cn } from "@/lib/utils";

import { ChatActivityFieldList } from "./ChatActivityFieldList";
import {
  ChatActivityStateIcon,
  chatActivityStateToneClass,
} from "./ChatActivityStateIcon";

export function ChatActivityTimelineRow({
  row,
  part,
}) {
  const [open, setOpen] = React.useState(false);
  const tone = chatActivityStateToneClass(row.state);

  if (row.state === "agent-error") {
    return <AgentErrorRow row={row} tone={tone} />;
  }

  return (
    <div
      data-slot="agent-activity-row"
      data-state={row.state}
      className="flex flex-col gap-1"
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="hover:bg-accent/30 -ml-1 flex w-fit items-center gap-2 rounded-sm px-1 py-0.5 text-left text-xs"
      >
        <Chevron open={open} />
        <ChatActivityStateIcon state={row.state} className={tone} />
        <span className="text-foreground/80">{row.label}</span>
        {row.chip ? (
          <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 font-mono text-[10px]">
            {row.chip}
          </span>
        ) : null}
      </button>
      {open ? <RowPanel row={row} part={part} /> : null}
    </div>
  );
}

function AgentErrorRow({
  row,
  tone,
}) {
  return (
    <div
      data-slot="agent-activity-row"
      data-state={row.state}
      className="flex flex-col gap-1"
    >
      <div className="-ml-1 flex w-fit items-center gap-2 px-1 py-0.5 text-xs">
        <span aria-hidden="true" className="inline-block size-3" />
        <ChatActivityStateIcon state={row.state} className={tone} />
        <span className="text-foreground/80">{row.label}</span>
      </div>
      {row.errorMessage ? (
        <p className="text-destructive ml-7 text-xs">{row.errorMessage}</p>
      ) : null}
    </div>
  );
}

function RowPanel({
  row,
  part,
}) {
  const { toolRenderers } = useChatExtension();
  const Renderer = part ? toolRenderers[row.toolName]?.row : undefined;
  return (
    <div className="border-border/60 ml-4 flex flex-col gap-3 border-l pl-3 pb-2 text-xs">
      {Renderer && part ? (
        <Renderer {...toolPartPropsFromPart(part)} />
      ) : (
        <DefaultPanel row={row} />
      )}
    </div>
  );
}

function DefaultPanel({ row }) {
  return (
    <>
      <ChatActivityFieldList title="Input" fields={row.inputFields} />
      {row.outputFields.length > 0 ? (
        <ChatActivityFieldList title="Output" fields={row.outputFields} />
      ) : null}
      {row.errorMessage ? (
        <p className="text-destructive">{row.errorMessage}</p>
      ) : null}
    </>
  );
}

function toolPartPropsFromPart(part) {
  return {
    toolName: part.toolName,
    toolCallId: part.toolCallId,
    input: part.input,
    output: part.output,
    state: part.state,
    errorMessage: part.state === "output-error" ? part.errorText : undefined,
  };
}

function Chevron({ open }) {
  return (
    <ChevronRight
      aria-hidden="true"
      className={cn(
        "size-3 transition-transform duration-150",
        open && "rotate-90",
      )}
    />
  );
}
