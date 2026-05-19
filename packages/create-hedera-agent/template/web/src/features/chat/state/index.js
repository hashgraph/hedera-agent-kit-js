// Browser-facing API for the chat store. Each function looks up the browser's
// localStorage on call, so it works inside React effects without retaining a
// reference that might survive a hot-reload-style replacement.
//
// Functions that need adapter injection (tests, future sync backends) should
// import directly from `./chat-store`.

import {
  createChat as createChatBase,
  deleteChat as deleteChatBase,
  deriveAutoTitle,
  loadChat as loadChatBase,
  loadChatIndex as loadChatIndexBase,
  QuotaExhaustedError,
  renameChat as renameChatBase,
  resetStaleEntries,
  saveChat as saveChatBase,
} from "./chat-store";
import { notifyChange, onChange } from "./events";
import { getBrowserStorage } from "./storage-adapter";

export { QuotaExhaustedError, deriveAutoTitle, onChange };

// Run once per page-load: drop any pre-v2 blobs so the sidebar doesn't list
// stale entries that no longer parse. Acceptable for a starter template per
// the refactor PRD's Out of Scope: "Migrating existing localStorage entries
// from the pre-refactor shape."
let staleScanComplete = false;
function scanForStaleEntries() {
  if (staleScanComplete) return;
  staleScanComplete = true;
  const adapter = getBrowserStorage();
  if (!adapter) return;
  const reset = resetStaleEntries(adapter);
  if (reset) {
    console.warn(
      "[chat] Cleared pre-v2 chat history after schema-version bump. New chats will persist normally.",
    );
  }
}

export function loadChatIndex() {
  scanForStaleEntries();
  const adapter = getBrowserStorage();
  if (!adapter) return [];
  return loadChatIndexBase(adapter);
}

export function loadChat(id) {
  scanForStaleEntries();
  const adapter = getBrowserStorage();
  if (!adapter) return null;
  return loadChatBase(adapter, id);
}

export function saveChat(chat) {
  const adapter = getBrowserStorage();
  if (!adapter) return;
  saveChatBase(adapter, chat);
  notifyChange();
}

export function createChat(options = {}) {
  scanForStaleEntries();
  const adapter = getBrowserStorage();
  if (!adapter) {
    // No storage available (SSR). Return an in-memory chat so callers can still
    // render — the next client-side save will persist it.
    return {
      id: options.id ?? fallbackId(),
      title: options.title ?? "New chat",
      updatedAt: Date.now(),
      messages: [],
    };
  }
  const chat = createChatBase(adapter, options);
  notifyChange();
  return chat;
}

export function deleteChat(id) {
  const adapter = getBrowserStorage();
  if (!adapter) return;
  deleteChatBase(adapter, id);
  notifyChange();
}

export function renameChat(id, newTitle) {
  const adapter = getBrowserStorage();
  if (!adapter) return null;
  const result = renameChatBase(adapter, id, newTitle);
  notifyChange();
  return result;
}

function fallbackId() {
  return `chat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
