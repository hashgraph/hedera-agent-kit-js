"use client";

import { Wallet } from "lucide-react";

import { cn } from "@/lib/utils";
import { useWallet } from "@/features/chat-wallet/WalletProvider";

// Header pill that opens / closes the right-side wallet drawer. Mimics the
// account chip MetaMask renders in dApp headers: short address + a pending-
// count badge when the wallet has approval requests waiting.
export function ChatWalletButton() {
  const wallet = useWallet();
  const pending = wallet.pendingApprovals.length;
  return (
    <button
      type="button"
      onClick={wallet.toggle}
      aria-haspopup="dialog"
      aria-expanded={wallet.isOpen}
      title="Open wallet"
      className={cn(
        "bg-muted text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 relative inline-flex h-8 items-center gap-2 rounded-md px-3 text-xs font-medium transition-colors outline-none focus-visible:ring-[3px]",
      )}
    >
      <Wallet className="size-3.5" />
      <span className="text-foreground font-mono">
        {truncateAccountId(wallet.accountId)}
      </span>
      <span aria-hidden>·</span>
      <span>{wallet.network}</span>
      {pending > 0 ? (
        <span
          aria-label={`${pending} pending approval${pending === 1 ? "" : "s"}`}
          className="absolute -top-1 -right-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white"
        >
          {pending}
        </span>
      ) : null}
    </button>
  );
}

function truncateAccountId(id) {
  // Most chain account ids are short enough to display inline, but long ids
  // (e.g. EVM addresses) get truncated so the pill stays compact.
  if (id.length <= 12) return id;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}
