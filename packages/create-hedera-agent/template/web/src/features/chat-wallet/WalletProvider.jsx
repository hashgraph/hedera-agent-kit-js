"use client";

import * as React from "react";

// Chain-agnostic in-browser wallet for the HITL approval flow. The signing
// implementation is injected from the app layer as a `(bytes) => Promise<bytes>`
// function, so the wallet has no knowledge of which chain it serves. The
// account id and network strings are also injected for display only.
// Swapping this for a real wallet SDK (WalletConnect, HashPack, etc.) means
// replacing the `signer` prop and nothing else in this feature.

const WalletContext = React.createContext(null);

export function ChatWalletProvider({
  accountId,
  network,
  signer,
  children,
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [pendingApprovals, setPendingApprovals] = React.useState([]);

  const open = React.useCallback(() => setIsOpen(true), []);
  const close = React.useCallback(() => setIsOpen(false), []);
  const toggle = React.useCallback(() => setIsOpen((v) => !v), []);

  const enqueueApproval = React.useCallback((approval) => {
    setPendingApprovals((current) => {
      // Replace any existing entry for the same toolCallId so a re-render
      // (e.g. the chat re-mounting an awaiting-approval card) doesn't
      // duplicate the request in the drawer.
      const others = current.filter((p) => p.toolCallId !== approval.toolCallId);
      return [...others, approval];
    });
    // Auto-open the drawer when a new request lands, MetaMask-style "popup
    // forces itself open" behavior. The wallet button's pending badge still
    // signals it if the user closes the drawer without acting.
    setIsOpen(true);
  }, []);

  const clearApproval = React.useCallback((toolCallId) => {
    setPendingApprovals((current) => {
      const next = current.filter((p) => p.toolCallId !== toolCallId);
      // Auto-close the drawer once the queue empties so the chat surface
      // returns to focus after the user approves or rejects. They can
      // reopen via the wallet button at any time. If a new approval lands,
      // `enqueueApproval` re-opens it MetaMask-style.
      if (next.length === 0) setIsOpen(false);
      return next;
    });
  }, []);

  const value = React.useMemo(
    () => ({
      accountId,
      network,
      isOpen,
      open,
      close,
      toggle,
      pendingApprovals,
      enqueueApproval,
      clearApproval,
      signTransactionBytes: signer,
    }),
    [
      accountId,
      network,
      isOpen,
      open,
      close,
      toggle,
      pendingApprovals,
      enqueueApproval,
      clearApproval,
      signer,
    ],
  );

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = React.useContext(WalletContext);
  if (!ctx) {
    throw new Error("useWallet must be called inside a <ChatWalletProvider>.");
  }
  return ctx;
}
