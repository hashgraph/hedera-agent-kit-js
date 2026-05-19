import * as React from "react";
import { ExternalLink } from "lucide-react";

import { CardContent } from "@/components/ui/card";
import { buildHashscanUrl } from "@/features/chat-hedera/utils/hashscan-url";

export function ChatHederaTransactionCardDetails({
  summary,
  state,
  network,
  transactionId,
  errorMessage,
}) {
  const hashscanUrl = buildHashscanUrl({
    network,
    transactionId,
    hashscanPath: summary.hashscanPath,
  });

  return (
    <CardContent className="px-4">
      <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1.5 text-xs">
        {summary.fields.map((field) => (
          <React.Fragment key={field.label}>
            <dt className="text-muted-foreground">{field.label}</dt>
            <dd className="whitespace-pre-wrap break-words font-mono">
              {field.value}
            </dd>
          </React.Fragment>
        ))}
        {transactionId ? (
          <>
            <dt className="text-muted-foreground">Tx ID</dt>
            <dd className="break-all font-mono">{transactionId}</dd>
          </>
        ) : null}
      </dl>
      {state === "failed" && errorMessage ? (
        <p className="text-destructive mt-3 text-xs">{errorMessage}</p>
      ) : null}
      {hashscanUrl && state === "confirmed" ? (
        <a
          href={hashscanUrl}
          target="_blank"
          rel="noreferrer"
          className="text-primary mt-3 inline-flex items-center gap-1 text-xs font-medium hover:underline"
        >
          View on Hashscan <ExternalLink className="size-3" />
        </a>
      ) : null}
    </CardContent>
  );
}
