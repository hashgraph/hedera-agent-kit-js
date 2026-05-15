import { beforeEach, describe, expect, it } from "vitest";

import { getMode, setMode, subscribeMode } from "./mode-store";

// Reset the module store to "human" before each case. The store is module-
// level so it persists across describes; without this reset, ordering would
// affect outcomes.
beforeEach(() => {
  setMode("human");
});

describe("mode-store", () => {
  it("should return the current mode on getMode", () => {
    expect(getMode()).toBe("human");
    setMode("auto");
    expect(getMode()).toBe("auto");
  });

  it("should notify subscribers on a mode change", () => {
    let calls = 0;
    const unsubscribe = subscribeMode(() => {
      calls += 1;
    });

    setMode("auto");

    expect(calls).toBe(1);
    unsubscribe();
  });

  it("should skip notification when setMode is called with the current value", () => {
    setMode("auto");
    let calls = 0;
    const unsubscribe = subscribeMode(() => {
      calls += 1;
    });

    setMode("auto");

    expect(calls).toBe(0);
    unsubscribe();
  });

  it("should stop notifying after unsubscribe", () => {
    let calls = 0;
    const unsubscribe = subscribeMode(() => {
      calls += 1;
    });

    setMode("auto");
    unsubscribe();
    setMode("human");

    expect(calls).toBe(1);
  });
});
