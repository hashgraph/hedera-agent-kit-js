// Module-level mirror of the React-context mode. Two consumers read this
// independently: React via `useSyncExternalStore` inside the provider, and the
// `hederaExtension.getRequestBody` function, a non-React callsite invoked by
// the chat substrate's transport closure. Keeping a single source of truth
// here means `getRequestBody` never goes through React internals and always
// observes the latest user-selected value, including after the AI SDK's
// auto-resubmit-after-tool-completion (which captures the contributor once).

const STORAGE_KEY = "chat-hedera:mode";

// SSR-safe initial value. The persisted value is loaded into the store via
// `hydrateMode()` from the provider's effect after mount; using "auto" here
// keeps server-rendered HTML deterministic so React doesn't flag a hydration
// mismatch on first paint.
let currentMode = "auto";
const listeners = new Set();

export function getMode() {
  return currentMode;
}

export function setMode(mode) {
  if (currentMode === mode) return;
  currentMode = mode;
  persistMode(mode);
  for (const listener of listeners) listener();
}

export function subscribeMode(listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Loads the persisted mode into the store if present. Called by the provider
// in a mount effect so the read happens client-side only and after hydration.
export function hydrateMode() {
  if (typeof window === "undefined") return;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "human" || stored === "auto") {
      setMode(stored);
    }
  } catch {
    // localStorage can throw in private mode or with corrupt storage; treat
    // unreadable persistence as "no preference set" and stick with the default.
  }
}

function persistMode(mode) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Quota / private-mode failures are non-fatal; in-memory state still
    // reflects the user's choice for the current session.
  }
}
