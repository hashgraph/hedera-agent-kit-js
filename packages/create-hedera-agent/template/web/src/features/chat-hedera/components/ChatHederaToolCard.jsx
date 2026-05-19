"use client";

import * as React from "react";

import { useChatToolActions } from "@/features/chat/extension";
import { HEDERA_NETWORK } from "@/features/chat-hedera/utils/network";
import {
  extractOutcome,
  mapToolPartState,
} from "@/features/chat-hedera/utils/tool-part-mapper";

import { ChatHederaTransactionCard } from "./ChatHederaTransactionCard";

// Renderer registered as the `card` slot for every Hedera mutating tool.
// Filters non-mutating tools (no card surface), maps the substrate's tool-part
// state plus tool output into the card's display state, and hands off to the
// presentational `ChatHederaTransactionCard`. The HITL signing flow lives in
// `useChatHederaSigning`, consumed inside the card's actions sub-component.
export function ChatHederaToolCard({
  toolName,
  toolCallId,
  input,
  output,
  state,
  errorMessage: errorMessageFromSubstrate,
}) {
  const { mutatingToolMethods, isToolCallPending } = useChatToolActions();

  // Read-only tools never render a card; the timeline row is their full
  // audit footprint. Mutating-tool classification lives on the server's
  // toolkit and is threaded through context, no client-side allowlist.
  if (!mutatingToolMethods.has(toolName)) {
    return null;
  }

  const isSigning = isToolCallPending(toolCallId);
  const outcome = extractOutcome(state, output, errorMessageFromSubstrate);
  const cardState = mapToolPartState(state, outcome, isSigning);

  return (
    <ChatHederaTransactionCard
      toolName={toolName}
      toolCallId={toolCallId}
      input={input}
      state={cardState}
      network={HEDERA_NETWORK}
      transactionId={outcome.transactionId}
      status={outcome.status}
      errorMessage={outcome.errorMessage}
      unsignedBytes={outcome.unsignedBytes}
    />
  );
}
