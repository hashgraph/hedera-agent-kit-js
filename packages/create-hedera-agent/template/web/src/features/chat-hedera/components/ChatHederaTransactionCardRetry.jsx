import * as React from "react";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

export function ChatHederaTransactionCardRetry({
  errorMessage,
  onRetry,
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 pb-4">
      <p className="text-xs text-amber-700 dark:text-amber-400">
        {errorMessage ?? "Network or infrastructure error."}
      </p>
      {onRetry ? (
        <Button size="sm" variant="outline" onClick={onRetry}>
          <RefreshCw className="size-3.5" /> Retry
        </Button>
      ) : null}
    </div>
  );
}
