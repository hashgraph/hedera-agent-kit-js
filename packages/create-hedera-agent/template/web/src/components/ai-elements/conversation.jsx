"use client";

import * as React from "react";
import { ArrowDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Conversation({ className, children, ...props }) {
  const viewportRef = React.useRef(null);
  const contentRef = React.useRef(null);
  const [pinnedToBottom, setPinnedToBottom] = React.useState(true);
  // Mirror `pinnedToBottom` into a ref so the ResizeObserver closure (set up
  // once on mount) can read the latest value without re-subscribing whenever
  // the user scrolls. `client-passive-event-listeners` / `advanced-use-latest`.
  const pinnedToBottomRef = React.useRef(true);
  React.useEffect(() => {
    pinnedToBottomRef.current = pinnedToBottom;
  }, [pinnedToBottom]);

  const scrollToBottom = React.useCallback(
    (behavior = "smooth") => {
      const el = viewportRef.current;
      if (!el) return;
      el.scrollTo({ top: el.scrollHeight, behavior });
    },
    [],
  );

  const onScroll = React.useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setPinnedToBottom(distanceFromBottom < 64);
  }, []);

  // Auto-scroll only when the content size actually grows, not on every parent
  // render. The previous implementation depended on the entire `children` tree
  // — identity-fresh every render — so the effect fired (and scrolled) per
  // streamed token even when no new vertical space appeared.
  React.useEffect(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;
    const observer = new ResizeObserver(() => {
      if (pinnedToBottomRef.current) {
        viewport.scrollTo({ top: viewport.scrollHeight, behavior: "auto" });
      }
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      data-slot="conversation"
      className={cn("relative flex-1 min-h-0", className)}
      {...props}
    >
      <div
        ref={viewportRef}
        onScroll={onScroll}
        className="h-full overflow-y-auto px-4 py-6"
      >
        <div ref={contentRef}>{children}</div>
      </div>
      {!pinnedToBottom && (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => scrollToBottom("smooth")}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 shadow-md"
        >
          <ArrowDown className="size-3.5" /> Jump to latest
        </Button>
      )}
    </div>
  );
}

export function ConversationContent({
  className,
  ...props
}) {
  return (
    <div
      data-slot="conversation-content"
      className={cn("mx-auto flex max-w-3xl flex-col gap-6", className)}
      {...props}
    />
  );
}

export function ConversationEmptyState({
  className,
  title,
  description,
  children,
  ...props
}) {
  return (
    <div
      data-slot="conversation-empty-state"
      className={cn(
        "mx-auto flex max-w-md flex-col items-center justify-center gap-3 py-16 text-center",
        className,
      )}
      {...props}
    >
      {title ? (
        <div className="text-base font-semibold">{title}</div>
      ) : null}
      {description ? (
        <div className="text-muted-foreground text-sm">{description}</div>
      ) : null}
      {children}
    </div>
  );
}
