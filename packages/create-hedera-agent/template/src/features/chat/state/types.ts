import type { ChatMessage } from "@/features/chat/types";

export type ChatIndexEntry = {
  id: string;
  title: string;
  updatedAt: number;
};

export type StoredChat = {
  id: string;
  title: string;
  updatedAt: number;
  messages: ChatMessage[];
};

// Minimal surface area we need from the browser's `localStorage`. Injectable for
// tests (no jsdom needed) and for any future migration to a different sync store.
export type StorageAdapter = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  // Used for orphan / quota-victim scans. Returns a snapshot so callers can
  // safely mutate storage while iterating.
  keys(): string[];
};
