"use client";

import * as React from "react";
import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

// Variant-discriminated chip / pulse / label surface. `ChatActivity` decides
// which variant applies based on the derived activity view model and own
// stopped-hold lifecycle; the indicator itself is purely presentational and
// does not introspect the activity model.

export function ChatActivityIndicator(props) {
  switch (props.kind) {
    case "wait":
      return <WaitPulse />;
    case "stopped":
      return <StoppedLabel />;
    case "progress":
      return (
        <ProgressLabel
          label={props.label}
          expandable={props.expandable}
          open={props.open}
          onToggle={props.onToggle}
        />
      );
    case "resting":
      return (
        <RestingLabel
          stepCount={props.stepCount}
          failed={props.failed === true}
          open={props.open}
          onToggle={props.onToggle}
        />
      );
  }
}

function WaitPulse() {
  return (
    <div data-slot="agent-activity-wait" className="px-1 py-3">
      {/* Layered ping ripple over a solid center: the outer span scales-out
          and fades via Tailwind's `animate-ping`, the inner span stays solid
          so the eye locks onto a stable shape. More legible than
          `animate-pulse`'s opacity tween. */}
      <span
        aria-hidden="true"
        className="relative inline-flex size-3 items-center justify-center"
      >
        <span className="bg-muted-foreground absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" />
        <span className="bg-foreground relative inline-flex size-3 rounded-full" />
      </span>
      <span className="sr-only">Agent is thinking</span>
    </div>
  );
}

function StoppedLabel() {
  return (
    <span
      data-slot="agent-activity-stopped"
      className="text-muted-foreground flex items-center gap-2 text-xs"
    >
      <Dot animate={false} />
      <span>Stopped</span>
    </span>
  );
}

function ProgressLabel({
  label,
  expandable,
  open,
  onToggle,
}) {
  if (!expandable) {
    return (
      <span
        data-slot="agent-activity-progress"
        className="flex items-center gap-2 text-xs"
      >
        <Dot />
        <span className="shimmer-text font-medium">{label}</span>
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      data-slot="agent-activity-progress"
      className="text-muted-foreground hover:text-foreground/80 -ml-1 flex w-fit items-center gap-2 rounded-sm px-1 text-left text-xs"
    >
      <Dot />
      <span className="shimmer-text font-medium">{label}</span>
      <Chevron open={open} />
    </button>
  );
}

function RestingLabel({
  stepCount,
  failed,
  open,
  onToggle,
}) {
  const action = open ? "Hide" : "View";
  const countText = stepCount > 0 ? ` (${stepCount})` : "";
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      data-slot="agent-activity-resting"
      data-failed={failed || undefined}
      className="text-muted-foreground hover:text-foreground -ml-1 inline-flex w-fit items-center gap-1 rounded-sm px-1 text-xs transition-colors"
    >
      <Chevron open={open} />
      <span>{`${action} activity${countText}`}</span>
      {failed ? <span className="text-destructive">· failed</span> : null}
    </button>
  );
}

function Dot({ animate = true }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "bg-muted-foreground inline-block size-1.5 rounded-full",
        animate && "animate-pulse",
      )}
    />
  );
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
