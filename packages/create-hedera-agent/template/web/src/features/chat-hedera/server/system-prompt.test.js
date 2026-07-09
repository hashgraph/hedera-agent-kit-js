import { describe, expect, it } from "vitest";
import { renderSystemPrompt } from "@/features/chat-hedera/server/system-prompt";

describe("renderSystemPrompt", () => {
  it("should return the template unchanged when no variables are provided", () => {
    const template = "Plain text without placeholders.";

    const rendered = renderSystemPrompt(template);

    expect(rendered).toBe(template);
  });

  it("should return the template unchanged regardless of supplied variables", () => {
    // The shared agent module pre-substitutes operator id, network, and mode
    // into its `systemPrompt` export; `renderSystemPrompt` is now an identity
    // function preserved as a backwards-compatible shim.
    const template = "Operator: {{operatorId}}, Network: {{network}}, Mode: {{mode}}";

    const rendered = renderSystemPrompt(template, {
      operatorId: "0.0.1234",
      network: "testnet",
      mode: "human",
    });

    expect(rendered).toBe(template);
  });
});
