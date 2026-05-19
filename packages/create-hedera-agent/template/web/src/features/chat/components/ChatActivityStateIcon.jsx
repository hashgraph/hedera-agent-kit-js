import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  Square,
  X,
  XCircle,
} from "lucide-react";

import { cn } from "@/lib/utils";

export function ChatActivityStateIcon({
  state,
  className,
}) {
  switch (state) {
    case "pending":
      return <Loader2 className={cn("size-3 animate-spin", className)} />;
    case "success":
      return <CheckCircle2 className={cn("size-3", className)} />;
    case "failure":
      return <XCircle className={cn("size-3", className)} />;
    case "rejected":
      return <X className={cn("size-3", className)} />;
    case "network-error":
      return <AlertTriangle className={cn("size-3", className)} />;
    case "awaiting-approval":
      return <ShieldCheck className={cn("size-3", className)} />;
    case "stopped":
      return <Square className={cn("size-3", className)} />;
    case "agent-error":
      return <AlertOctagon className={cn("size-3", className)} />;
  }
}

export function chatActivityStateToneClass(state) {
  switch (state) {
    case "pending":
    case "rejected":
    case "stopped":
      return "text-muted-foreground";
    case "success":
      return "text-emerald-600 dark:text-emerald-400";
    case "failure":
    case "agent-error":
      return "text-destructive";
    case "network-error":
    case "awaiting-approval":
      return "text-amber-600 dark:text-amber-400";
  }
}
