import { describe, expect, it } from "vitest";

import { suggestions } from "@/features/chat-hedera/utils/suggestions";

describe("suggestions", () => {
  it("should expose exactly six chips", () => {
    expect(suggestions).toHaveLength(6);
  });

  it("should cover the six categories listed in the PRD", () => {
    const expected = [
      "account-query",
      "token-query",
      "token-create",
      "hbar-transfer",
      "consensus-submit",
      "transaction-history",
    ];
    const actual = suggestions.map((chip) => chip.category).sort();
    expect(actual).toEqual([...expected].sort());
  });

  it("should give every chip a unique id", () => {
    const ids = suggestions.map((chip) => chip.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("should mark mutating chips and leave query chips unmarked", () => {
    const byCategory = Object.fromEntries(
      suggestions.map((chip) => [chip.category, chip.mutating]),
    );

    expect(byCategory["account-query"]).toBe(false);
    expect(byCategory["token-query"]).toBe(false);
    expect(byCategory["transaction-history"]).toBe(false);
    expect(byCategory["token-create"]).toBe(true);
    expect(byCategory["hbar-transfer"]).toBe(true);
    expect(byCategory["consensus-submit"]).toBe(true);
  });

  it("should ship a non-empty prompt and label for every chip", () => {
    for (const chip of suggestions) {
      expect(chip.label.trim().length).toBeGreaterThan(0);
      expect(chip.prompt.trim().length).toBeGreaterThan(0);
    }
  });

  it("should embed a Hedera placeholder id in chips that reference existing entities", () => {
    // Token-create is the one chip that mints a new entity rather than
    // referencing one — every other prompt assumes the user will swap in a
    // real account / token / topic id before submitting.
    const placeholderPattern = /0\.0\.[A-Za-z0-9<>_]+/;
    const requirePlaceholder = suggestions.filter(
      (chip) => chip.category !== "token-create",
    );
    for (const chip of requirePlaceholder) {
      expect(chip.prompt).toMatch(placeholderPattern);
    }
  });
});
