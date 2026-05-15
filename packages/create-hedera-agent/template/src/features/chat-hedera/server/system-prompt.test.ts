import { describe, expect, it } from "vitest";
import { renderSystemPrompt } from "@/features/chat-hedera/server/system-prompt";

describe("renderSystemPrompt", () => {
  it("should substitute all supported variables", () => {
    const template =
      "Operator: {{operatorId}}, Network: {{network}}, Mode: {{mode}}";

    const rendered = renderSystemPrompt(template, {
      operatorId: "0.0.1234",
      network: "testnet",
      mode: "human",
    });

    expect(rendered).toBe("Operator: 0.0.1234, Network: testnet, Mode: human");
  });

  it("should substitute the same variable multiple times", () => {
    const template = "{{mode}} mode (currently {{mode}})";

    const rendered = renderSystemPrompt(template, { mode: "auto" });

    expect(rendered).toBe("auto mode (currently auto)");
  });

  it("should tolerate whitespace inside the braces", () => {
    const template = "Network: {{ network }}";

    const rendered = renderSystemPrompt(template, { network: "mainnet" });

    expect(rendered).toBe("Network: mainnet");
  });

  it("should leave the placeholder unchanged when no variables are provided", () => {
    const template = "Operator: {{operatorId}}";

    const rendered = renderSystemPrompt(template);

    expect(rendered).toBe("Operator: ");
  });

  it("should substitute supplied variables and blank out missing supported ones", () => {
    const template = "{{operatorId}} on {{network}} ({{mode}})";

    const rendered = renderSystemPrompt(template, { network: "testnet" });

    expect(rendered).toBe(" on testnet ()");
  });

  it("should leave unknown variables intact", () => {
    const template = "Hello {{unknownVar}} from {{operatorId}}";

    const rendered = renderSystemPrompt(template, { operatorId: "0.0.1" });

    expect(rendered).toBe("Hello {{unknownVar}} from 0.0.1");
  });

  it("should leave a template without placeholders untouched", () => {
    const template = "Plain text without placeholders.";

    const rendered = renderSystemPrompt(template, { mode: "auto" });

    expect(rendered).toBe(template);
  });
});
