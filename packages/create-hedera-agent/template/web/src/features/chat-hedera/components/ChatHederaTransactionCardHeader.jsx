import * as React from "react";

import {
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { stateBadgeAppearance } from "@/features/chat-hedera/utils/transaction-card-state";

export function ChatHederaTransactionCardHeader({
  title,
  toolName,
  state,
  status,
}) {
  const badge = stateBadgeAppearance(state, status);
  return (
    <CardHeader className="px-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <CardTitle className="text-sm">{title}</CardTitle>
          <CardDescription className="text-muted-foreground font-mono text-xs">
            {toolName}
          </CardDescription>
        </div>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
            badge.className,
          )}
        >
          {badge.icon}
          {badge.label}
        </span>
      </div>
    </CardHeader>
  );
}
