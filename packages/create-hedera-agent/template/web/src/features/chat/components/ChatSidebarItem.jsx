"use client";

import * as React from "react";
import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { ChatSidebarItemRename } from "./ChatSidebarItemRename";

export function ChatSidebarItem({
  entry,
  isActive,
  onDelete,
}) {
  const [isEditing, setIsEditing] = React.useState(false);

  if (isEditing) {
    return (
      <ChatSidebarItemRename
        entry={entry}
        onDone={() => setIsEditing(false)}
      />
    );
  }

  return (
    <li
      className={cn(
        "group hover:bg-accent flex items-center gap-1 rounded-md",
        isActive && "bg-accent",
      )}
    >
      <Link
        href={`/chat/${encodeURIComponent(entry.id)}`}
        className="min-w-0 flex-1 truncate px-2 py-1.5 text-sm"
        title={entry.title}
      >
        {entry.title}
      </Link>
      <Button
        size="icon"
        variant="ghost"
        className="size-7 opacity-0 group-hover:opacity-100"
        onClick={() => setIsEditing(true)}
        title="Rename"
      >
        <Pencil className="size-3.5" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="size-7 opacity-0 group-hover:opacity-100"
        onClick={onDelete}
        title="Delete"
      >
        <Trash2 className="size-3.5" />
      </Button>
    </li>
  );
}
