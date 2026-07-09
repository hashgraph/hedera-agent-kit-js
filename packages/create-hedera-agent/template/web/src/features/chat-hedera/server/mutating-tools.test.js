import { describe, expect, it } from "vitest";
import { getMutatingToolMethods } from "@/features/chat-hedera/server/mutating-tools";

function plugin(name, methods) {
  return {
    name,
    version: "1.0.0",
    tools: () =>
      methods.map((method) => ({
        method,
        name: method,
        description: "",
        // Only `method` is read by getMutatingToolMethods.
        parameters: undefined,
        execute: async () => undefined,
      })),
  };
}

describe("getMutatingToolMethods", () => {
  it("should include methods from non-query plugins", () => {
    const plugins = [plugin("core-account-plugin", ["transfer_hbar_tool"])];

    const result = getMutatingToolMethods(plugins);

    expect(result.has("transfer_hbar_tool")).toBe(true);
  });

  it("should exclude methods from query plugins", () => {
    const plugins = [
      plugin("core-account-query-plugin", ["get_hbar_balance_query_tool"]),
    ];

    const result = getMutatingToolMethods(plugins);

    expect(result.has("get_hbar_balance_query_tool")).toBe(false);
  });

  it("should bucket multiple plugins by query-name convention", () => {
    const plugins = [
      plugin("core-token-plugin", ["create_fungible_token_tool"]),
      plugin("core-token-query-plugin", ["get_token_info_query_tool"]),
      plugin("core-misc-query-plugin", ["get_exchange_rate_tool"]),
      plugin("core-consensus-plugin", ["submit_topic_message_tool"]),
    ];

    const result = getMutatingToolMethods(plugins);

    expect(result.has("create_fungible_token_tool")).toBe(true);
    expect(result.has("submit_topic_message_tool")).toBe(true);
    expect(result.has("get_token_info_query_tool")).toBe(false);
    expect(result.has("get_exchange_rate_tool")).toBe(false);
  });

  it("should return an empty set when no plugins are registered", () => {
    expect(getMutatingToolMethods([]).size).toBe(0);
  });

  it("should deduplicate methods that appear in multiple plugins", () => {
    const plugins = [
      plugin("core-account-plugin", ["transfer_hbar_tool"]),
      plugin("core-extras-plugin", ["transfer_hbar_tool"]),
    ];

    const result = getMutatingToolMethods(plugins);

    expect(result.size).toBe(1);
    expect(result.has("transfer_hbar_tool")).toBe(true);
  });
});
