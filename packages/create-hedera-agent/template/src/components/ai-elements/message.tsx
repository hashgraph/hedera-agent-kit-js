"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

type Role = "user" | "assistant" | "system";

type MessageProps = React.ComponentProps<"div"> & {
  from: Role;
};

export function Message({ from, className, children, ...props }: MessageProps) {
  return (
    <div
      data-slot="message"
      data-role={from}
      className={cn(
        "flex w-full",
        from === "user" ? "justify-end" : "justify-start",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

type MessageContentProps = React.ComponentProps<"div"> & {
  from?: Role;
};

export function MessageContent({
  from = "assistant",
  className,
  children,
  ...props
}: MessageContentProps) {
  return (
    <div
      data-slot="message-content"
      data-role={from}
      className={cn(
        "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm",
        from === "user"
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
