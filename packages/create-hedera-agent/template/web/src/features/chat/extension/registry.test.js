import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mergeExtensions } from "./registry";

// Spy lets us assert on the development-mode collision warnings without
// littering the test output. Restored after each test so a stray warning in
// one case can't leak into the next assertion.
let warnSpy;

beforeEach(() => {
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockRestore();
});

function ext(overrides) {
  return { ...overrides };
}

describe("mergeExtensions", () => {
  describe("ordering", () => {
    it("should concatenate suggestions across extensions in registration order", () => {
      const a = ext({
        id: "a",
        suggestions: [
          { id: "a-1", label: "A1", prompt: "do A1" },
          { id: "a-2", label: "A2", prompt: "do A2" },
        ],
      });
      const b = ext({
        id: "b",
        suggestions: [{ id: "b-1", label: "B1", prompt: "do B1" }],
      });

      const merged = mergeExtensions([a, b]);

      expect(merged.suggestions.map((c) => c.id)).toEqual([
        "a-1",
        "a-2",
        "b-1",
      ]);
    });

    it("should join non-empty system prompts with a blank line in extension order", () => {
      const a = ext({ id: "a", systemPrompt: "First contribution." });
      const b = ext({ id: "b", systemPrompt: "Second contribution." });

      const merged = mergeExtensions([a, b]);

      expect(merged.systemPrompt).toBe(
        "First contribution.\n\nSecond contribution.",
      );
    });

    it("should skip empty / missing system prompts when joining", () => {
      const a = ext({ id: "a", systemPrompt: "" });
      const b = ext({ id: "b" });
      const c = ext({ id: "c", systemPrompt: "Only c." });

      const merged = mergeExtensions([a, b, c]);

      expect(merged.systemPrompt).toBe("Only c.");
    });

  });

  describe("per-tool slot collisions", () => {
    it("should warn and last-write-win when two extensions register a summarizer for the same tool", () => {
      const first = () => ({ title: "first", fields: [] });
      const second = () => ({ title: "second", fields: [] });
      const a = ext({ id: "a", toolSummarizers: { transfer: first } });
      const b = ext({ id: "b", toolSummarizers: { transfer: second } });

      const merged = mergeExtensions([a, b]);

      expect(merged.toolSummarizers.transfer({}).title).toBe("second");
      expect(warnSpy).toHaveBeenCalledTimes(1);
      const [message] = warnSpy.mock.calls[0] ?? [];
      expect(String(message)).toContain('Tool summarizer "transfer"');
      expect(String(message)).toContain('extension "b"');
      expect(String(message)).toContain('previous owner: "a"');
    });

    it("should warn independently for card and row collisions on the same tool", () => {
      const FirstCard = () => null;
      const SecondCard = () => null;
      const SharedRow = () => null;
      const a = ext({
        id: "a",
        toolRenderers: { transfer: { card: FirstCard, row: SharedRow } },
      });
      const b = ext({
        id: "b",
        toolRenderers: { transfer: { card: SecondCard } },
      });

      const merged = mergeExtensions([a, b]);

      expect(merged.toolRenderers.transfer.card).toBe(SecondCard);
      // Row only contributed by `a` — should NOT trigger a collision warning.
      expect(merged.toolRenderers.transfer.row).toBe(SharedRow);
      // Card collision is the only warning we expect.
      expect(warnSpy).toHaveBeenCalledTimes(1);
      const [message] = warnSpy.mock.calls[0] ?? [];
      expect(String(message)).toContain("Tool card renderer");
    });

    it("should merge non-colliding card and row contributions for the same tool without warning", () => {
      const Card = () => null;
      const Row = () => null;
      const a = ext({ id: "a", toolRenderers: { transfer: { card: Card } } });
      const b = ext({ id: "b", toolRenderers: { transfer: { row: Row } } });

      const merged = mergeExtensions([a, b]);

      expect(merged.toolRenderers.transfer.card).toBe(Card);
      expect(merged.toolRenderers.transfer.row).toBe(Row);
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  describe("request body aggregation", () => {
    it("should merge request body contributions opaquely via Object.assign in extension order", () => {
      const a = ext({ id: "a", getRequestBody: () => ({ mode: "human", x: 1 }) });
      const b = ext({ id: "b", getRequestBody: () => ({ y: 2 }) });

      const merged = mergeExtensions([a, b]);
      const body = merged.buildRequestBody();

      expect(body).toEqual({ mode: "human", x: 1, y: 2 });
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it("should warn and last-write-win on overlapping request-body keys", () => {
      const a = ext({ id: "a", getRequestBody: () => ({ mode: "human" }) });
      const b = ext({ id: "b", getRequestBody: () => ({ mode: "auto" }) });

      const merged = mergeExtensions([a, b]);
      const body = merged.buildRequestBody();

      expect(body).toEqual({ mode: "auto" });
      expect(warnSpy).toHaveBeenCalledTimes(1);
      const [message] = warnSpy.mock.calls[0] ?? [];
      expect(String(message)).toContain('Request-body key "mode"');
      expect(String(message)).toContain('extension "b"');
      expect(String(message)).toContain('previous owner: "a"');
    });

    it("should skip non-object request-body contributions", () => {
      const a = ext({
        id: "a",
        // Deliberately misuse the type to verify defensive handling.
        getRequestBody: () => null,
      });
      const b = ext({ id: "b", getRequestBody: () => ({ ok: true }) });

      const merged = mergeExtensions([a, b]);
      const body = merged.buildRequestBody();

      expect(body).toEqual({ ok: true });
    });

    it("should return an empty body when no extension contributes", () => {
      const merged = mergeExtensions([ext({ id: "a" })]);

      expect(merged.buildRequestBody()).toEqual({});
    });
  });

  describe("edge cases", () => {
    it("should produce an empty registry when no extensions are registered", () => {
      const merged = mergeExtensions([]);

      expect(merged.toolRenderers).toEqual({});
      expect(merged.toolSummarizers).toEqual({});
      expect(merged.suggestions).toEqual([]);
      expect(merged.systemPrompt).toBe("");
      expect(merged.buildRequestBody()).toEqual({});
    });

    it("should not include extensions with all empty slots in any merged surface", () => {
      const merged = mergeExtensions([ext({ id: "noop" })]);

      expect(merged.suggestions).toEqual([]);
      expect(merged.systemPrompt).toBe("");
    });
  });
});
