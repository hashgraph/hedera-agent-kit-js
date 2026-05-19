"use client";

import * as React from "react";
import { AlertTriangle, Check, ClipboardCopy, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useWallet } from "@/features/chat-wallet/WalletProvider";

// Right-side slide-in panel that mimics a wallet app (MetaMask / HashPack
// style). Mounted once at the app root so it can overlay any route. Auto-opens
// when a new approval lands in the queue. See WalletProvider.enqueueApproval.
export function ChatWalletDrawer() {
  const wallet = useWallet();
  return (
    <>
      <div
        aria-hidden
        onClick={wallet.close}
        className={cn(
          "fixed inset-0 z-40 bg-black/40 transition-opacity duration-200",
          wallet.isOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      <aside
        role="dialog"
        aria-label="Wallet"
        aria-hidden={!wallet.isOpen}
        className={cn(
          "bg-background fixed top-0 right-0 z-50 flex h-full w-full max-w-sm transform flex-col border-l shadow-xl transition-transform duration-200 ease-out",
          wallet.isOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        <header className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Wallet</h2>
          <Button
            size="sm"
            variant="ghost"
            onClick={wallet.close}
            aria-label="Close wallet"
            className="h-7 w-7 p-0"
          >
            <X className="size-4" />
          </Button>
        </header>
        <div className="flex flex-1 flex-col gap-4 overflow-auto p-4">
          <SimulationBanner />
          <AccountCard accountId={wallet.accountId} network={wallet.network} />
          <PendingApprovals approvals={wallet.pendingApprovals} />
        </div>
      </aside>
    </>
  );
}

function SimulationBanner() {
  return (
    <aside
      role="note"
      aria-label="Wallet simulation notice"
      className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-[11px] leading-snug text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"
    >
      <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
      <div>
        <p className="font-semibold">Simulated wallet</p>
        <p className="mt-0.5">
          This drawer signs in-browser with the server-provided operator key.
          For real apps, replace it with a wallet integration (WalletConnect,
          HashPack, etc.) so the key never leaves the user&apos;s device.
        </p>
      </div>
    </aside>
  );
}

function AccountCard({ accountId, network }) {
  const [copied, setCopied] = React.useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(accountId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API can fail in non-secure contexts. The address is still
      // visible in the card so the user can select it manually.
    }
  };
  return (
    <section className="rounded-md border p-4">
      <div className="flex items-center gap-3">
        <div className="from-primary/60 to-primary/20 size-10 rounded-full bg-gradient-to-br" />
        <div className="flex flex-1 flex-col">
          <span className="text-muted-foreground text-[11px] uppercase tracking-wide">
            Account
          </span>
          <span className="font-mono text-sm">{accountId}</span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => void copy()}
          className="h-7 px-2 text-xs"
          aria-label="Copy account ID"
        >
          {copied ? <Check className="size-3.5" /> : <ClipboardCopy className="size-3.5" />}
        </Button>
      </div>
      <div className="text-muted-foreground mt-3 flex items-center justify-between text-xs">
        <span>Network</span>
        <span className="bg-muted rounded px-2 py-0.5 font-medium">
          {network}
        </span>
      </div>
    </section>
  );
}

function PendingApprovals({ approvals }) {
  if (approvals.length === 0) {
    return (
      <section className="text-muted-foreground rounded-md border border-dashed p-4 text-center text-xs">
        No pending requests.
      </section>
    );
  }
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">
        Pending requests
      </h3>
      {approvals.map((approval) => (
        <PendingApprovalCard key={approval.toolCallId} approval={approval} />
      ))}
    </section>
  );
}

function PendingApprovalCard({ approval }) {
  // Destructure stable callbacks; the full `wallet` object changes identity
  // on every internal state update.
  const { signTransactionBytes, clearApproval } = useWallet();
  const [isBusy, setIsBusy] = React.useState(false);
  const [error, setError] = React.useState(null);

  const approve = React.useCallback(async () => {
    if (isBusy) return;
    setIsBusy(true);
    setError(null);
    try {
      const signedBytes = await signTransactionBytes(approval.unsignedBytes);
      await approval.onApprove(signedBytes);
      clearApproval(approval.toolCallId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setIsBusy(false);
    }
  }, [approval, clearApproval, isBusy, signTransactionBytes]);

  const reject = React.useCallback(async () => {
    if (isBusy) return;
    setIsBusy(true);
    setError(null);
    try {
      await approval.onReject();
      clearApproval(approval.toolCallId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setIsBusy(false);
    }
  }, [approval, clearApproval, isBusy]);

  return (
    <article className="bg-card rounded-md border p-3">
      <div className="flex flex-col gap-2">
        <div>
          <p className="text-xs font-medium">{approval.summary.title}</p>
          <p className="text-muted-foreground font-mono text-[11px]">
            {approval.toolName}
          </p>
        </div>
        {approval.summary.fields.length > 0 ? (
          <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-[11px]">
            {approval.summary.fields.map((field) => (
              <React.Fragment key={field.label}>
                <dt className="text-muted-foreground">{field.label}</dt>
                <dd className="break-words font-mono">{field.value}</dd>
              </React.Fragment>
            ))}
          </dl>
        ) : null}
        {error ? <p className="text-destructive text-xs">{error}</p> : null}
        <div className="flex items-center justify-end gap-2 pt-1">
          <Button
            size="sm"
            variant="outline"
            onClick={() => void reject()}
            disabled={isBusy}
          >
            <X className="size-3.5" /> Reject
          </Button>
          <Button
            size="sm"
            onClick={() => void approve()}
            disabled={isBusy}
          >
            {isBusy ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Check className="size-3.5" />
            )}{" "}
            Approve
          </Button>
        </div>
      </div>
    </article>
  );
}
