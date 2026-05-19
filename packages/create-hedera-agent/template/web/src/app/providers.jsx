"use client";

import * as React from "react";

import { ChatExtensionProvider } from "@/features/chat/extension";
import {
  ChatHederaModeProvider,
  createHederaSigner,
  HEDERA_NETWORK,
  hederaExtension,
} from "@/features/chat-hedera";
import { ChatWalletDrawer, ChatWalletProvider } from "@/features/chat-wallet";

// Stable singleton array so the provider's `useMemo` over `extensions` doesn't
// rebuild the merged registry on every render of the root layout.
const EXTENSIONS = [hederaExtension];

// App-root client wrapper that mounts every extension-aware provider. Server
// components (e.g. layout.tsx) render this around their children; it stays
// client-side so the React contexts are available to every nested component.
//
// The wallet is chain-agnostic: the app builds a Hedera signer here and hands
// it in as a prop, plus the display strings for the account id and network.
// Swapping the wallet to another chain (or a real wallet SDK) is a change to
// these three props only.
//
// Mode provider wraps the extension provider so the toggle node can read mode
// context through the same tree.
export function AppProviders({ children, accountId, signingKey }) {
  const signer = React.useMemo(
    () => createHederaSigner(signingKey),
    [signingKey],
  );
  return (
    <ChatWalletProvider
      accountId={accountId}
      network={HEDERA_NETWORK}
      signer={signer}
    >
      <ChatHederaModeProvider>
        <ChatExtensionProvider extensions={EXTENSIONS}>
          {children}
          <ChatWalletDrawer />
        </ChatExtensionProvider>
      </ChatHederaModeProvider>
    </ChatWalletProvider>
  );
}
