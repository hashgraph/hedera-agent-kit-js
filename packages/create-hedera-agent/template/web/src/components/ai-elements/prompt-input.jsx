"use client";

import * as React from "react";
import { ArrowUp, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export function PromptInput({ className, children, ...props }) {
  return (
    <form
      data-slot="prompt-input"
      className={cn(
        "border-input bg-background flex w-full flex-col gap-2 rounded-2xl border p-3 shadow-sm",
        className,
      )}
      {...props}
    >
      {children}
    </form>
  );
}

export function PromptInputTextarea({
  className,
  onKeyDown,
  onSubmit,
  ...props
}) {
  function handleKeyDown(event) {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onSubmit?.();
    }
  }

  return (
    <Textarea
      data-slot="prompt-input-textarea"
      onKeyDown={handleKeyDown}
      rows={1}
      className={cn(
        "min-h-10 resize-none border-0 bg-transparent px-1 py-1 shadow-none focus-visible:ring-0",
        className,
      )}
      {...props}
    />
  );
}

export function PromptInputToolbar({
  className,
  ...props
}) {
  return (
    <div
      data-slot="prompt-input-toolbar"
      className={cn("flex items-center justify-between gap-2", className)}
      {...props}
    />
  );
}

export function PromptInputSubmit({
  status = "ready",
  className,
  ...props
}) {
  const isStreaming = status === "submitted" || status === "streaming";
  return (
    <Button
      type="submit"
      size="icon"
      data-slot="prompt-input-submit"
      data-status={status}
      className={cn("size-8 rounded-full", className)}
      {...props}
    >
      {isStreaming ? (
        <Square className="size-3.5 fill-current" />
      ) : (
        <ArrowUp className="size-4" />
      )}
    </Button>
  );
}
