"use client";

import * as React from "react";
import { Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { renameChat } from "@/features/chat/state";

// Inline rename form swapped in for the row's normal display while editing.
// Owns the draft + focus state locally so it resets cleanly each time it's
// remounted (parent flips `isEditing` to show/hide this component).
export function ChatSidebarItemRename({
  entry,
  onDone,
}) {
  const [draft, setDraft] = React.useState(entry.title);
  const inputRef = React.useRef(null);

  React.useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== entry.title) {
      renameChat(entry.id, trimmed);
    }
    onDone();
  };

  return (
    <li className="flex items-center gap-1 px-1">
      <Input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            onDone();
          }
        }}
        className="h-8 text-sm"
      />
      <Button
        size="icon"
        variant="ghost"
        className="size-7"
        onClick={commit}
        title="Save"
      >
        <Check className="size-3.5" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="size-7"
        onClick={onDone}
        title="Cancel"
      >
        <X className="size-3.5" />
      </Button>
    </li>
  );
}
