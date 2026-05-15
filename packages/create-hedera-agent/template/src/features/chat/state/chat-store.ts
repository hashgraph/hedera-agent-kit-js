import {
  isChatToolPart,
  type ChatMessage,
  type ChatTextPart,
} from "@/features/chat/types";
import {
  CURRENT_SCHEMA_VERSION,
  INDEX_KEY,
  chatKey,
  parseChatKey,
} from "./keys";
import { isQuotaExceeded } from "./storage-adapter";
import type { ChatIndexEntry, StorageAdapter, StoredChat } from "./types";

const TITLE_MAX_LENGTH = 40;
const NEW_CHAT_TITLE = "New chat";

export type CreateChatOptions = {
  id?: string;
  title?: string;
};

// Public CRUD. Each function accepts the StorageAdapter explicitly so the same
// implementation is exercised by both the browser and the unit tests against an
// in-memory adapter. The thin browser-facing wrapper lives in `index.ts`.

export function loadChatIndex(adapter: StorageAdapter): ChatIndexEntry[] {
  const raw = adapter.getItem(INDEX_KEY);
  if (!raw) return [];
  const parsed = safeParse(raw);
  if (!Array.isArray(parsed)) return [];
  const entries = parsed
    .map(normalizeIndexEntry)
    .filter((e): e is ChatIndexEntry => e !== null);
  return sortIndexEntries(entries);
}

export function loadChat(adapter: StorageAdapter, id: string): StoredChat | null {
  const raw = adapter.getItem(chatKey(id));
  if (!raw) return null;
  const parsed = safeParse(raw);
  return normalizeStoredChat(parsed);
}

export function saveChat(adapter: StorageAdapter, chat: StoredChat): void {
  const sanitized: StoredChat = {
    id: chat.id,
    title: chat.title || NEW_CHAT_TITLE,
    updatedAt: chat.updatedAt || Date.now(),
    messages: chat.messages,
  };
  const result = writeChatBlob(adapter, sanitized);
  if (!result.ok) {
    // The blob got dropped by the quota recovery; the index entry was already
    // removed inside writeChatBlob. Skip the upsert so we don't resurrect a
    // ghost row in the sidebar.
    return;
  }
  upsertIndexEntry(adapter, {
    id: sanitized.id,
    title: sanitized.title,
    updatedAt: sanitized.updatedAt,
  });
}

export function createChat(
  adapter: StorageAdapter,
  options: CreateChatOptions = {},
): StoredChat {
  const id = options.id ?? generateChatId();
  const chat: StoredChat = {
    id,
    title: options.title ?? NEW_CHAT_TITLE,
    updatedAt: Date.now(),
    messages: [],
  };
  saveChat(adapter, chat);
  return chat;
}

export function deleteChat(adapter: StorageAdapter, id: string): void {
  adapter.removeItem(chatKey(id));
  removeIndexEntry(adapter, id);
}

export function renameChat(
  adapter: StorageAdapter,
  id: string,
  newTitle: string,
): StoredChat | null {
  const title = newTitle.trim() || NEW_CHAT_TITLE;
  const chat = loadChat(adapter, id);
  if (!chat) {
    // Index-only fallback: rename the index entry even if the per-chat blob is
    // gone, so the sidebar reflects the user's intent until the next write
    // recreates the chat body.
    updateIndexEntry(adapter, id, (entry) => ({ ...entry, title }));
    return null;
  }
  const updated: StoredChat = { ...chat, title, updatedAt: Date.now() };
  saveChat(adapter, updated);
  return updated;
}

// Derives a deterministic title from the first user message. Returns null if
// the chat has no user message yet — callers keep the existing title in that
// case. Truncates to roughly 40 characters with an ellipsis so the sidebar
// rows stay one line.
export function deriveAutoTitle(messages: ReadonlyArray<ChatMessage>): string | null {
  for (const message of messages) {
    if (message.role !== "user") continue;
    const text = extractText(message);
    if (!text) continue;
    return truncate(text, TITLE_MAX_LENGTH);
  }
  return null;
}

// Drop any pre-v2 chat blobs and the index from storage. Called once at
// browser-side hydration so a user upgrading the template doesn't see a
// half-broken sidebar where old chats render as empty rows. Per PRD's
// Out of Scope: the template is a scaffold; existing devs accept a one-time
// chat reset at the schema-version bump.
export function resetStaleEntries(adapter: StorageAdapter): boolean {
  let removed = false;
  for (const key of adapter.keys()) {
    const parsed = parseChatKey(key);
    if (!parsed) continue;
    if (parsed.version === CURRENT_SCHEMA_VERSION) continue;
    adapter.removeItem(key);
    removed = true;
  }
  // Wipe the index too — even if the index entries reference v2 ids, the index
  // shape itself changed (no `mode`) and re-deriving it from existing v2 blobs
  // is the safe thing to do on the next save.
  if (removed) {
    adapter.removeItem(INDEX_KEY);
  }
  return removed;
}

// ------------ Internals ------------

function upsertIndexEntry(
  adapter: StorageAdapter,
  entry: ChatIndexEntry,
): void {
  const existing = loadChatIndex(adapter);
  const next = existing.filter((e) => e.id !== entry.id);
  next.push(entry);
  writeIndex(adapter, sortIndexEntries(next));
}

function removeIndexEntry(adapter: StorageAdapter, id: string): void {
  const existing = loadChatIndex(adapter);
  const next = existing.filter((e) => e.id !== id);
  writeIndex(adapter, next);
}

function updateIndexEntry(
  adapter: StorageAdapter,
  id: string,
  updater: (entry: ChatIndexEntry) => ChatIndexEntry,
): void {
  const existing = loadChatIndex(adapter);
  const next = existing.map((e) => (e.id === id ? updater(e) : e));
  writeIndex(adapter, sortIndexEntries(next));
}

function writeIndex(adapter: StorageAdapter, entries: ChatIndexEntry[]): void {
  try {
    adapter.setItem(INDEX_KEY, JSON.stringify(entries));
  } catch (error) {
    if (!isQuotaExceeded(error)) throw error;
    // The index is small; we don't try to evict chats to make room for it.
    // Bubble up so the caller can surface this — silently nuking the archive
    // by retrying with an empty index would be far worse than a visible error.
    throw new QuotaExhaustedError(
      "localStorage quota exhausted; could not persist chat index",
    );
  }
}

// Write a chat blob with quota recovery. Strategy: try once, on quota error
// evict the largest OTHER chat and retry once, and on a second failure drop
// the offending chat itself. Returns `{ ok: false }` when the chat had to be
// dropped so callers can skip subsequent index updates.
function writeChatBlob(
  adapter: StorageAdapter,
  chat: StoredChat,
): { ok: true } | { ok: false } {
  const key = chatKey(chat.id);
  const value = JSON.stringify(chat);
  try {
    adapter.setItem(key, value);
    return { ok: true };
  } catch (error) {
    if (!isQuotaExceeded(error)) throw error;
  }

  const victim = pickQuotaVictim(adapter, new Set([chat.id]));
  if (victim) {
    adapter.removeItem(chatKey(victim.id));
    removeIndexEntry(adapter, victim.id);
    try {
      adapter.setItem(key, value);
      return { ok: true };
    } catch (retryError) {
      if (!isQuotaExceeded(retryError)) throw retryError;
    }
  }

  // Even after evicting the largest other chat we can't fit this one. Drop it
  // so the archive stays consistent — the in-flight save is lost, nothing else.
  adapter.removeItem(key);
  removeIndexEntry(adapter, chat.id);
  return { ok: false };
}

function pickQuotaVictim(
  adapter: StorageAdapter,
  protectedIds: Set<string>,
): { id: string; size: number } | null {
  let largest: { id: string; size: number } | null = null;
  for (const key of adapter.keys()) {
    const parsed = parseChatKey(key);
    if (!parsed) continue;
    if (parsed.version !== CURRENT_SCHEMA_VERSION) continue;
    if (protectedIds.has(parsed.id)) continue;
    const value = adapter.getItem(key);
    const size = value ? value.length : 0;
    if (!largest || size > largest.size) {
      largest = { id: parsed.id, size };
    }
  }
  return largest;
}

export class QuotaExhaustedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuotaExhaustedError";
  }
}

function sortIndexEntries(entries: ChatIndexEntry[]): ChatIndexEntry[] {
  return [...entries].sort((a, b) => b.updatedAt - a.updatedAt);
}

function normalizeIndexEntry(value: unknown): ChatIndexEntry | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== "string" || !v.id) return null;
  if (typeof v.title !== "string") return null;
  if (typeof v.updatedAt !== "number") return null;
  return {
    id: v.id,
    title: v.title,
    updatedAt: v.updatedAt,
  };
}

function normalizeStoredChat(value: unknown): StoredChat | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== "string" || !v.id) return null;
  if (typeof v.title !== "string") return null;
  if (typeof v.updatedAt !== "number") return null;
  if (!Array.isArray(v.messages)) return null;
  return {
    id: v.id,
    title: v.title,
    updatedAt: v.updatedAt,
    messages: v.messages as ChatMessage[],
  };
}

function safeParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function extractText(message: ChatMessage): string {
  const segments: string[] = [];
  for (const part of message.parts) {
    if (isChatToolPart(part)) continue;
    const textPart = part as ChatTextPart;
    if (typeof textPart.text === "string") segments.push(textPart.text);
  }
  return segments.join(" ").trim();
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 1))}…`;
}

function generateChatId(): string {
  if (typeof globalThis.crypto !== "undefined" && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  // Fallback for older environments — sufficient for single-user, single-tab.
  return `chat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
