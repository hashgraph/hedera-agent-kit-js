"use client";

import * as React from "react";

import {
  getMode,
  hydrateMode,
  setMode,
  subscribeMode,
} from "../state/mode-store";

// Single app-wide value per PRD's "Mode is global and not per-chat". The
// context exposes the current mode and a setter; the toggle component
// consumes both. The chat substrate never reads or writes this context —
// mode reaches the wire via the Hedera extension's `getRequestBody` slot,
// which reads from the module-level store the provider keeps in sync.

const ChatHederaModeContext = React.createContext(null);

export function ChatHederaModeProvider({ children }) {
  const mode = React.useSyncExternalStore(subscribeMode, getMode, getMode);

  // Load the persisted mode after mount. Kept out of module init so the first
  // server-rendered render matches the client's first render ("auto"); the
  // store then flips to the persisted value on the first effect tick.
  React.useEffect(() => {
    hydrateMode();
  }, []);

  const value = React.useMemo(
    () => ({ mode, setMode }),
    [mode],
  );
  return (
    <ChatHederaModeContext.Provider value={value}>
      {children}
    </ChatHederaModeContext.Provider>
  );
}

export function useChatHederaMode() {
  const ctx = React.useContext(ChatHederaModeContext);
  if (!ctx) {
    throw new Error(
      "useChatHederaMode must be called inside a <ChatHederaModeProvider>.",
    );
  }
  return ctx;
}
