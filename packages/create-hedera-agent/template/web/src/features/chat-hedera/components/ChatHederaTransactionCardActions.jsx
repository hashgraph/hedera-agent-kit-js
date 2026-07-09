"use client";

import * as React from "react";
import { Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useChatToolActions } from "@/features/chat/extension";
import { useWallet } from "@/features/chat-wallet";

// In-chat affordance that hands the approval off to the wallet drawer. The
// effect enqueues the request on mount (with onApprove/onReject closures
// bound to the chat substrate's `useChatToolActions`); the cleanup clears it
// when the card transitions to a terminal state. The actual Approve / Reject
// UI lives in `ChatWalletDrawer` so the chat surface stays calm and the
// signing flow looks like a real wallet popup.
export function ChatHederaTransactionCardActions({
  toolName,
  toolCallId,
  input,
  summary,
  unsignedBytes,
}) {
  // Destructure the stable callbacks individually. The full `wallet` object's
  // identity changes whenever any wallet state updates (pendingApprovals,
  // isOpen). Using it as a useEffect dep would loop forever.
  const { enqueueApproval, clearApproval, open: openWallet } = useWallet();
  const { addToolResult, setToolCallPending } = useChatToolActions();

  React.useEffect(() => {
    if (!unsignedBytes) return;

    const pushResult = (envelope) =>
      addToolResult({
        tool: toolName,
        toolCallId,
        output: JSON.stringify(envelope),
      });

    const onApprove = async (signedBytes) => {
      setToolCallPending(toolCallId, true);
      try {
        const res = await fetch("/api/transactions/submit-signed", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ signedBytes }),
        });
        if (res.ok) {
          const rawJson = await res.text();
          await addToolResult({ tool: toolName, toolCallId, output: rawJson });
          return;
        }
        const message =
          (await safeReadText(res)) || `Submit request failed (${res.status})`;
        await pushResult({
          raw: { status: "FAILED", error: message },
          humanMessage: message,
        });
      } finally {
        setToolCallPending(toolCallId, false);
      }
    };

    const onReject = async () => {
      await pushResult({
        raw: { status: "REJECTED" },
        humanMessage:
          "User rejected the transaction. Ask a focused clarifying question instead of retrying or apologizing.",
      });
    };

    enqueueApproval({
      toolCallId,
      toolName,
      input,
      summary,
      unsignedBytes,
      onApprove,
      onReject,
    });
    return () => {
      clearApproval(toolCallId);
    };
  }, [
    addToolResult,
    clearApproval,
    enqueueApproval,
    input,
    setToolCallPending,
    summary,
    toolCallId,
    toolName,
    unsignedBytes,
  ]);

  if (!unsignedBytes) {
    return (
      <div className="flex items-center justify-between gap-3 px-4 pb-4">
        <p className="text-muted-foreground text-xs">
          This chat was created with the previous approval flow. Re-prompt to use
          the in-browser wallet.
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 px-4 pb-4">
      <p className="text-muted-foreground text-xs">
        Waiting for wallet approval…
      </p>
      <Button size="sm" variant="outline" onClick={openWallet}>
        <Wallet className="size-3.5" /> Open wallet
      </Button>
    </div>
  );
}

async function safeReadText(res) {
  try {
    const text = await res.text();
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === "object" && "error" in parsed) {
        const err = parsed.error;
        return typeof err === "string" ? err : text;
      }
    } catch {
      // not JSON, return raw text
    }
    return text;
  } catch {
    return "";
  }
}
