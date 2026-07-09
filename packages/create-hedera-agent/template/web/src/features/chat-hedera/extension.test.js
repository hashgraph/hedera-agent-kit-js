import { afterEach, describe, expect, it } from "vitest";

import { hederaExtension } from "./extension";
import { setMode } from "./state/mode-store";

// Module store persists across cases; reset to the default at end-of-test so
// neighboring tests in the suite see a consistent baseline.
afterEach(() => {
  setMode("auto");
});

describe("hederaExtension.getRequestBody", () => {
  it("should contribute the current mode value to the outgoing request body", () => {
    setMode("auto");

    const body = hederaExtension.getRequestBody?.();

    expect(body).toEqual({ mode: "auto" });
  });

  it("should observe a mode change between consecutive calls", () => {
    setMode("human");
    expect(hederaExtension.getRequestBody?.()).toEqual({ mode: "human" });

    setMode("auto");
    expect(hederaExtension.getRequestBody?.()).toEqual({ mode: "auto" });
  });
});

describe("hederaExtension", () => {
  it("should declare a stable id for collision warnings", () => {
    expect(hederaExtension.id).toBe("hedera");
  });
});
