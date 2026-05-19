"use client";

import * as React from "react";
import { Streamdown } from "streamdown";

import { cn } from "@/lib/utils";

// Renders assistant text as markdown. Streamdown is purpose-built for streaming
// LLM output — it handles incomplete tokens (unfinished `**bold`, half-written
// code fences, partial tables) without flickering or throwing mid-render, which
// `react-markdown` would do. Prose styling is inlined via arbitrary-variant
// selectors so we don't pull in @tailwindcss/typography for one component.
export function Response({ children, className, ...props }) {
  return (
    <div
      data-slot="response"
      className={cn(
        "break-words [&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0",
        "[&_h1]:mt-4 [&_h1]:mb-2 [&_h1]:text-lg [&_h1]:font-semibold",
        "[&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold",
        "[&_h3]:mt-3 [&_h3]:mb-1.5 [&_h3]:text-sm [&_h3]:font-semibold",
        "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5",
        "[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5",
        "[&_li]:my-0.5",
        "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:no-underline",
        "[&_strong]:font-semibold",
        "[&_em]:italic",
        "[&_code]:bg-muted [&_code]:rounded-sm [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em]",
        "[&_pre]:bg-muted [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:p-3 [&_pre]:text-xs",
        "[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-[0.95em]",
        "[&_blockquote]:border-border [&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:italic",
        "[&_hr]:border-border [&_hr]:my-3",
        "[&_table]:my-2 [&_table]:w-full [&_table]:border-collapse",
        "[&_th]:border-border [&_th]:border-b [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:font-semibold",
        "[&_td]:border-border/60 [&_td]:border-b [&_td]:px-2 [&_td]:py-1",
        className,
      )}
      {...props}
    >
      <Streamdown>{children}</Streamdown>
    </div>
  );
}
