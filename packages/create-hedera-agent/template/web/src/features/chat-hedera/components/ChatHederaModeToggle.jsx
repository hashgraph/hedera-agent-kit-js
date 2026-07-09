"use client";

import * as React from "react";
import { Bot, User } from "lucide-react";

import { cn } from "@/lib/utils";
import { useChatHederaMode } from "../context/ChatHederaModeContext";

const MODES = ["human", "auto"];

const MODE_LABEL = {
  human: "Human",
  auto: "Auto",
};

// Title + body shown in the hover popover. Title repeats the button label so
// the popover reads cleanly without the user having to map it back to the
// button it belongs to.
const MODE_DESCRIPTION = {
  human: {
    title: "Human approval",
    body: "You stay in control. Whenever the agent wants to make a change, the wallet drawer opens so you can review and sign it yourself. Read-only requests like balance and account checks still run instantly. Nothing actually happens until you tap approve.",
  },
  auto: {
    title: "Auto",
    body: "Mutating transactions are signed and submitted immediately with the server-side operator key. Faster and demo-friendly, but no approval gate. Use only for trusted prompts on testnet.",
  },
};

const MODE_ICON = {
  human: User,
  auto: Bot,
};

// Hedera-specific mode switcher rendered into the chat substrate's `headerSlot`
// via `hederaExtension`. The substrate has no knowledge of mode semantics. It
// just routes the slot node into the header.
export function ChatHederaModeToggle() {
  const { mode, setMode } = useChatHederaMode();
  return (
    <div
      role="radiogroup"
      aria-label="Agent execution mode"
      className="bg-muted text-muted-foreground inline-flex h-8 items-center gap-0.5 rounded-md p-0.5 text-xs"
    >
      {MODES.map((option) => {
        const isActive = option === mode;
        const Icon = MODE_ICON[option];
        const popoverId = `chat-hedera-mode-popover-${option}`;
        const { title, body } = MODE_DESCRIPTION[option];
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-describedby={popoverId}
            onClick={() => setMode(option)}
            className={cn(
              "group focus-visible:ring-ring/50 relative inline-flex h-7 items-center gap-1.5 rounded-sm px-3 font-medium transition-colors outline-none focus-visible:ring-[3px]",
              isActive
                ? "bg-background text-foreground shadow-xs"
                : "hover:text-foreground",
            )}
          >
            <Icon className="size-3.5" />
            {MODE_LABEL[option]}
            {/* Popover. CSS-only, visible on hover / keyboard focus, hidden
                otherwise. Anchored below the button so it doesn't clip the
                header. `pointer-events-none` keeps the popover from stealing
                hover off the trigger. */}
            <span
              id={popoverId}
              role="tooltip"
              className={cn(
                "bg-popover text-popover-foreground pointer-events-none absolute top-full left-1/2 z-50 mt-2 w-64 -translate-x-1/2",
                "rounded-md border p-3 text-left text-xs font-normal shadow-md",
                "opacity-0 transition-opacity duration-150",
                "group-hover:opacity-100 group-focus-visible:opacity-100",
              )}
            >
              <span className="text-foreground block font-semibold">
                {title}
              </span>
              <span className="text-muted-foreground mt-1 block leading-snug">
                {body}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
