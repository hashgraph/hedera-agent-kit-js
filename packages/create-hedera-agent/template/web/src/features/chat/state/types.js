// Type definitions for chat state.
//
// @typedef {Object} ChatIndexEntry
// @property {string} id
// @property {string} title
// @property {number} updatedAt
//
// @typedef {Object} StoredChat
// @property {string} id
// @property {string} title
// @property {number} updatedAt
// @property {import("@/features/chat/types").ChatMessage[]} messages
//
// Minimal surface area we need from the browser's `localStorage`. Injectable for
// tests (no jsdom needed) and for any future migration to a different sync store.
// @typedef {Object} StorageAdapter
// @property {(key: string) => string | null} getItem
// @property {(key: string, value: string) => void} setItem
// @property {(key: string) => void} removeItem
// @property {() => string[]} keys
//
// `keys()` is used for orphan / quota-victim scans. Returns a snapshot so callers
// can safely mutate storage while iterating.

export {};
