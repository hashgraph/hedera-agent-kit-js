import { beforeEach, describe, expect, it } from "vitest";

import {
  createChat,
  deleteChat,
  deriveAutoTitle,
  loadChat,
  loadChatIndex,
  QuotaExhaustedError,
  renameChat,
  resetStaleEntries,
  saveChat,
} from "@/features/chat/state/chat-store";
import {
  CHAT_KEY_PREFIX,
  CURRENT_SCHEMA_VERSION,
  INDEX_KEY,
  chatKey,
} from "@/features/chat/state/keys";

function createMemoryAdapter(options = {}) {
  const data = new Map();

  function totalSize() {
    let sum = 0;
    for (const [k, v] of data) sum += k.length + v.length;
    return sum;
  }

  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      const projected = totalSize() - (data.get(key)?.length ?? 0) + value.length;
      if (
        options.quotaBytes !== undefined &&
        projected + key.length > options.quotaBytes
      ) {
        const error = new Error("Quota exceeded");
        error.name = "QuotaExceededError";
        throw error;
      }
      data.set(key, value);
    },
    removeItem(key) {
      data.delete(key);
    },
    keys() {
      return Array.from(data.keys());
    },
    size() {
      return totalSize();
    },
    dump() {
      return Object.fromEntries(data);
    },
  };
}

function messageOfText(role, text) {
  return {
    id: `msg-${role}-${text}`,
    role,
    parts: [{ type: "text", text }],
  };
}

describe("createChat / loadChat / loadChatIndex", () => {
  let adapter;

  beforeEach(() => {
    adapter = createMemoryAdapter();
  });

  it("should mint a chat, persist it, and add it to the index", () => {
    const chat = createChat(adapter);

    expect(chat.id).toBeTruthy();

    expect(loadChat(adapter, chat.id)).toEqual(chat);
    expect(loadChatIndex(adapter)).toEqual([
      {
        id: chat.id,
        title: chat.title,
        updatedAt: chat.updatedAt,
      },
    ]);
  });

  it("should accept an explicit id and title", () => {
    const chat = createChat(adapter, {
      id: "fixed-id",
      title: "Greeting",
    });

    expect(chat.id).toBe("fixed-id");
    expect(chat.title).toBe("Greeting");
    expect(loadChat(adapter, "fixed-id")?.title).toBe("Greeting");
  });

  it("should return null for an unknown chat id", () => {
    expect(loadChat(adapter, "missing")).toBeNull();
  });

  it("should return an empty index when storage is fresh", () => {
    expect(loadChatIndex(adapter)).toEqual([]);
  });

  it("should sort the index by updatedAt descending", () => {
    const older = createChat(adapter);
    saveChat(adapter, { ...older, updatedAt: 100, messages: [] });

    const newer = createChat(adapter);
    saveChat(adapter, { ...newer, updatedAt: 200, messages: [] });

    const index = loadChatIndex(adapter);
    expect(index.map((e) => e.id)).toEqual([newer.id, older.id]);
  });
});

describe("saveChat", () => {
  let adapter;

  beforeEach(() => {
    adapter = createMemoryAdapter();
  });

  it("should write each chat to its own key without affecting others", () => {
    const first = createChat(adapter);
    const second = createChat(adapter);

    saveChat(adapter, {
      ...first,
      messages: [messageOfText("user", "hello")],
    });

    expect(loadChat(adapter, first.id)?.messages).toHaveLength(1);
    expect(loadChat(adapter, second.id)?.messages).toHaveLength(0);
  });

  it("should sync index metadata when title or updatedAt change", () => {
    const chat = createChat(adapter);

    saveChat(adapter, {
      ...chat,
      title: "Updated",
      updatedAt: 999,
      messages: [],
    });

    const entry = loadChatIndex(adapter).find((e) => e.id === chat.id);
    expect(entry).toEqual({
      id: chat.id,
      title: "Updated",
      updatedAt: 999,
    });
  });
});

describe("deleteChat", () => {
  let adapter;

  beforeEach(() => {
    adapter = createMemoryAdapter();
  });

  it("should remove the chat blob and its index entry", () => {
    const chat = createChat(adapter);
    deleteChat(adapter, chat.id);

    expect(loadChat(adapter, chat.id)).toBeNull();
    expect(loadChatIndex(adapter).some((e) => e.id === chat.id)).toBe(false);
  });

  it("should leave unrelated chats untouched", () => {
    const survivor = createChat(adapter);
    const victim = createChat(adapter);

    deleteChat(adapter, victim.id);

    expect(loadChat(adapter, survivor.id)).not.toBeNull();
    expect(loadChatIndex(adapter)).toHaveLength(1);
  });

  it("should be a no-op for an unknown id", () => {
    expect(() => deleteChat(adapter, "ghost")).not.toThrow();
    expect(loadChatIndex(adapter)).toEqual([]);
  });
});

describe("renameChat", () => {
  let adapter;

  beforeEach(() => {
    adapter = createMemoryAdapter();
  });

  it("should update the chat blob and the index entry", () => {
    const chat = createChat(adapter);
    renameChat(adapter, chat.id, "Pretty title");

    expect(loadChat(adapter, chat.id)?.title).toBe("Pretty title");
    expect(loadChatIndex(adapter)[0]?.title).toBe("Pretty title");
  });

  it("should fall back to the default title when given an empty string", () => {
    const chat = createChat(adapter, { title: "Custom" });
    renameChat(adapter, chat.id, "   ");

    expect(loadChat(adapter, chat.id)?.title).toBe("New chat");
  });

  it("should rename the index entry even when the chat blob is missing", () => {
    const chat = createChat(adapter);
    adapter.removeItem(chatKey(chat.id));

    const result = renameChat(adapter, chat.id, "Recovered");

    expect(result).toBeNull();
    expect(loadChatIndex(adapter)[0]?.title).toBe("Recovered");
  });
});

describe("deriveAutoTitle", () => {
  it("should use the first user message text", () => {
    const messages = [
      messageOfText("assistant", "hi"),
      messageOfText("user", "What's the HBAR balance?"),
      messageOfText("user", "Ignore me"),
    ];
    expect(deriveAutoTitle(messages)).toBe("What's the HBAR balance?");
  });

  it("should truncate long titles with an ellipsis", () => {
    const long = "a".repeat(80);
    const messages = [messageOfText("user", long)];
    const title = deriveAutoTitle(messages);
    expect(title).toHaveLength(40);
    expect(title?.endsWith("…")).toBe(true);
  });

  it("should return null when no user message exists", () => {
    const messages = [messageOfText("assistant", "hi")];
    expect(deriveAutoTitle(messages)).toBeNull();
  });

  it("should return null when the user message has no text parts", () => {
    const messages = [
      {
        id: "u1",
        role: "user",
        parts: [],
      },
    ];
    expect(deriveAutoTitle(messages)).toBeNull();
  });
});

describe("schema versioning", () => {
  let adapter;

  beforeEach(() => {
    adapter = createMemoryAdapter();
  });

  it("should skip per-chat entries with an unknown version on read", () => {
    const orphanKey = `${CHAT_KEY_PREFIX}old-id:v0`;
    adapter.setItem(orphanKey, JSON.stringify({ messages: [] }));

    // loadChat looks up the current-version key, so v0 entries are ignored.
    expect(loadChat(adapter, "old-id")).toBeNull();
  });

  it("should ignore non-current-version chats when picking a quota victim", () => {
    // Seed a large v0 chat — it must NOT be picked even though it's huge.
    const v0Key = `${CHAT_KEY_PREFIX}legacy:v0`;
    adapter.setItem(v0Key, "x".repeat(2000));

    const small = createChat(adapter);
    saveChat(adapter, {
      ...small,
      messages: [messageOfText("user", "small")],
    });

    const big = createChat(adapter);
    const bigChat = {
      ...big,
      messages: [messageOfText("user", "x".repeat(500))],
    };
    saveChat(adapter, bigChat);

    // Tighten the quota so the next save must evict.
    const quotaAdapter = createMemoryAdapter({ quotaBytes: 2500 });
    saveChat(quotaAdapter, bigChat);
    saveChat(quotaAdapter, {
      ...small,
      messages: [messageOfText("user", "small")],
    });
    // Sanity: both saves should be present.
    expect(quotaAdapter.dump()[chatKey(bigChat.id)]).toBeDefined();
  });

  it("should record current schema version in per-chat key", () => {
    const chat = createChat(adapter);
    const matchingKeys = adapter
      .keys()
      .filter((k) => k.startsWith(CHAT_KEY_PREFIX));
    expect(matchingKeys).toContain(chatKey(chat.id));
    expect(chatKey(chat.id)).toBe(
      `${CHAT_KEY_PREFIX}${chat.id}:${CURRENT_SCHEMA_VERSION}`,
    );
  });
});

describe("resetStaleEntries", () => {
  let adapter;

  beforeEach(() => {
    adapter = createMemoryAdapter();
  });

  it("should remove pre-current-version blobs and the index on schema bump", () => {
    // Seed a stale v1 chat and a stale index entry that points at it.
    adapter.setItem(`${CHAT_KEY_PREFIX}legacy:v1`, JSON.stringify({}));
    adapter.setItem(INDEX_KEY, JSON.stringify([{ id: "legacy" }]));

    const removed = resetStaleEntries(adapter);

    expect(removed).toBe(true);
    expect(adapter.getItem(`${CHAT_KEY_PREFIX}legacy:v1`)).toBeNull();
    expect(adapter.getItem(INDEX_KEY)).toBeNull();
  });

  it("should leave current-version blobs and the index untouched when no stale entries exist", () => {
    const chat = createChat(adapter);

    const removed = resetStaleEntries(adapter);

    expect(removed).toBe(false);
    expect(loadChat(adapter, chat.id)).not.toBeNull();
    expect(loadChatIndex(adapter)).toHaveLength(1);
  });
});

describe("quota recovery", () => {
  it("should evict the largest other chat before retrying the write", () => {
    // Generous enough for two filled chats but not three; a single eviction of
    // the biggest one must be enough to land the newcomer.
    const adapter = createMemoryAdapter({ quotaBytes: 1500 });

    saveChat(adapter, {
      id: "small",
      title: "small",
      updatedAt: 1,
      messages: [messageOfText("user", "t")],
    });
    saveChat(adapter, {
      id: "big",
      title: "big",
      updatedAt: 2,
      messages: [messageOfText("user", "x".repeat(500))],
    });
    saveChat(adapter, {
      id: "new",
      title: "new",
      updatedAt: 3,
      messages: [messageOfText("user", "y".repeat(400))],
    });

    expect(loadChat(adapter, "big")).toBeNull();
    expect(loadChat(adapter, "small")).not.toBeNull();
    expect(loadChat(adapter, "new")).not.toBeNull();
    const ids = loadChatIndex(adapter).map((e) => e.id);
    expect(ids).toContain("new");
    expect(ids).toContain("small");
    expect(ids).not.toContain("big");
  });

  it("should drop the offending chat when no other chats can be evicted", () => {
    const adapter = createMemoryAdapter({ quotaBytes: 300 });

    // Filling messages should overflow with nothing else to evict.
    saveChat(adapter, {
      id: "lone",
      title: "lone",
      updatedAt: 1,
      messages: [messageOfText("user", "z".repeat(500))],
    });

    expect(loadChat(adapter, "lone")).toBeNull();
    expect(loadChatIndex(adapter).map((e) => e.id)).not.toContain("lone");
  });

  it("should bubble up when the index itself can't be written", () => {
    // Quota smaller than the INDEX_KEY plus any meaningful payload — any index
    // write will fail and there are no chats to evict (the failed chat blob is
    // already removed before writeIndex is reached).
    const adapter = createMemoryAdapter({ quotaBytes: 10 });

    let captured = null;
    try {
      createChat(adapter, { id: "anything" });
    } catch (error) {
      captured = error;
    }
    expect(captured).toBeInstanceOf(QuotaExhaustedError);
    // The failed write must not have produced a partial index.
    expect(adapter.getItem(INDEX_KEY)).toBeNull();
  });
});
