"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import {
  useChatExtension,
} from "@/features/chat/extension";

export function ChatEmptyState({ onSelect }) {
  const { suggestions } = useChatExtension();
  return (
    <div
      data-slot="empty-state"
      className="mx-auto flex w-full max-w-2xl flex-col items-center gap-6 py-16 text-center"
    >
      <div className="flex flex-col items-center gap-2">
        <div className="text-base font-semibold">
          Start chatting with your agent
        </div>
        <div className="text-muted-foreground text-sm">
          Pick a suggestion to populate the composer, then edit the placeholder
          IDs before sending.
        </div>
      </div>
      <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
        {suggestions.map((chip) => (
          <SuggestionButton key={chip.id} chip={chip} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}

function SuggestionButton({
  chip,
  onSelect,
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(chip.prompt)}
      className={cn(
        "border-input bg-background hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring/50",
        "flex flex-col items-start gap-1 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
        "outline-none focus-visible:ring-[3px]",
      )}
    >
      <div className="flex w-full items-center justify-between gap-2">
        <span className="font-medium">{chip.label}</span>
        {chip.mutating ? (
          <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
            Mutating
          </span>
        ) : null}
      </div>
      <span className="text-muted-foreground line-clamp-2 text-xs">
        {chip.prompt}
      </span>
    </button>
  );
}
