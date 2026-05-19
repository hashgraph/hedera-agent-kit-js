// Storage layout for multi-chat persistence.
//
//   hedera-chats:index            → JSON array of ChatIndexEntry, sorted by
//                                   updatedAt descending. Keeps the sidebar fast.
//   hedera-chat:<id>:v2           → JSON StoredChat. Per-chat key so a single
//                                   chat write can't blow up the entire archive
//                                   and quota recovery has fine-grained victims.
//
// Bumping the schema version (e.g. `:v3`) is how we adapt to backward-incompatible
// canonical-message shape changes — readers ignore unknown versions; writers only
// emit the current version.

export const INDEX_KEY = "hedera-chats:index";
export const CHAT_KEY_PREFIX = "hedera-chat:";
export const CURRENT_SCHEMA_VERSION = "v2";

export function chatKey(id, version = CURRENT_SCHEMA_VERSION) {
  return `${CHAT_KEY_PREFIX}${id}:${version}`;
}

// Parse a per-chat storage key. Returns null for keys that don't match the
// expected `hedera-chat:<id>:<version>` shape — used when scanning storage to
// recover from a corrupted or missing index.
export function parseChatKey(key) {
  if (!key.startsWith(CHAT_KEY_PREFIX)) return null;
  const rest = key.slice(CHAT_KEY_PREFIX.length);
  const lastColon = rest.lastIndexOf(":");
  if (lastColon === -1) return null;
  const id = rest.slice(0, lastColon);
  const version = rest.slice(lastColon + 1);
  if (!id || !version) return null;
  return { id, version };
}
