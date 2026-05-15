"use client";

import { useMemo } from "react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  stateBorderClass,
  type ChatHederaTransactionCardState,
} from "@/features/chat-hedera/utils/transaction-card-state";
import { summarize } from "@/features/chat-hedera/utils/transaction-summaries";

import { ChatHederaTransactionCardActions } from "./ChatHederaTransactionCardActions";
import { ChatHederaTransactionCardDetails } from "./ChatHederaTransactionCardDetails";
import { ChatHederaTransactionCardHeader } from "./ChatHederaTransactionCardHeader";
import { ChatHederaTransactionCardRetry } from "./ChatHederaTransactionCardRetry";

export type { ChatHederaTransactionCardState };

export type ChatHederaTransactionCardProps = Omit<
  React.ComponentProps<"div">,
  "onClick" | "children"
> & {
  toolName: string;
  // Required for `awaiting-approval`: the actions block binds the signing
  // hook to a specific call. Optional for terminal states that have no
  // affordances.
  toolCallId?: string;
  input: unknown;
  state: ChatHederaTransactionCardState;
  network?: "testnet" | "mainnet";
  transactionId?: string;
  status?: string;
  errorMessage?: string;
  // Absent on legacy chats persisted before the offline-sign flow shipped —
  // the actions block falls back to a discard-only affordance in that case.
  unsignedBytes?: string;
  onRetry?: () => void;
};

export function ChatHederaTransactionCard({
  toolName,
  toolCallId,
  input,
  state,
  network = "testnet",
  transactionId,
  status,
  errorMessage,
  unsignedBytes,
  onRetry,
  className,
  ...divProps
}: ChatHederaTransactionCardProps) {
  const summary = useMemo(() => summarize(toolName, input), [toolName, input]);

  return (
    <Card
      data-state={state}
      className={cn(
        "border-l-4 py-4 shadow-none",
        stateBorderClass(state),
        className,
      )}
      {...divProps}
    >
      <ChatHederaTransactionCardHeader
        title={summary.title}
        toolName={toolName}
        state={state}
        status={status}
      />
      <ChatHederaTransactionCardDetails
        summary={summary}
        state={state}
        network={network}
        transactionId={transactionId}
        errorMessage={errorMessage}
      />
      {state === "awaiting-approval" && toolCallId ? (
        <ChatHederaTransactionCardActions
          toolName={toolName}
          toolCallId={toolCallId}
          input={input}
          summary={summary}
          unsignedBytes={unsignedBytes}
        />
      ) : null}
      {state === "network-error" ? (
        <ChatHederaTransactionCardRetry
          errorMessage={errorMessage}
          onRetry={onRetry}
        />
      ) : null}
    </Card>
  );
}
