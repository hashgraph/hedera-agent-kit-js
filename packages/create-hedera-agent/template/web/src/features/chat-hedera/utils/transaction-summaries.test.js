import { describe, expect, it } from "vitest";
import {
  humanizeKey,
  humanizeToolName,
  summarize,
  transactionSummaries,
} from "@/features/chat-hedera/utils/transaction-summaries";

describe("summarize", () => {
  it("should format a transfer_hbar_tool input into a transfer line per recipient", () => {
    const summary = summarize("transfer_hbar_tool", {
      sourceAccountId: "0.0.1001",
      transfers: [
        { accountId: "0.0.2002", amount: 5 },
        { accountId: "0.0.3003", amount: 1.25 },
      ],
    });

    expect(summary.title).toBe("Transfer HBAR");
    const transfers = summary.fields.find((f) => f.label === "Transfers");
    expect(transfers?.value).toContain("5 ℏ → 0.0.2002");
    expect(transfers?.value).toContain("1.25 ℏ → 0.0.3003");
    expect(summary.fields.find((f) => f.label === "From")?.value).toBe("0.0.1001");
  });

  it("should include the memo on transfer_hbar_tool when one is provided", () => {
    const summary = summarize("transfer_hbar_tool", {
      transfers: [{ accountId: "0.0.2", amount: 1 }],
      transactionMemo: "payroll",
    });

    expect(summary.fields.find((f) => f.label === "Memo")?.value).toBe("payroll");
  });

  it("should format create_fungible_token_tool with the well-known token fields", () => {
    const summary = summarize("create_fungible_token_tool", {
      tokenName: "Acme Coin",
      tokenSymbol: "ACM",
      initialSupply: 1000,
      decimals: 2,
      supplyType: "finite",
      maxSupply: 1_000_000,
      treasuryAccountId: "0.0.1001",
    });

    expect(summary.title).toBe("Create fungible token");
    const labels = summary.fields.map((f) => f.label);
    expect(labels).toEqual(
      expect.arrayContaining([
        "Name",
        "Symbol",
        "Initial supply",
        "Decimals",
        "Supply type",
        "Max supply",
        "Treasury",
      ]),
    );
    expect(summary.fields.find((f) => f.label === "Name")?.value).toBe("Acme Coin");
  });

  it("should format mint_fungible_token_tool with token id and amount", () => {
    const summary = summarize("mint_fungible_token_tool", {
      tokenId: "0.0.555",
      amount: 100,
    });

    expect(summary.title).toBe("Mint tokens");
    expect(summary.fields).toEqual([
      { label: "Token", value: "0.0.555" },
      { label: "Amount", value: "100" },
    ]);
  });

  it("should format associate_token_tool with the comma-joined token id list", () => {
    const summary = summarize("associate_token_tool", {
      accountId: "0.0.1234",
      tokenIds: ["0.0.111", "0.0.222"],
    });

    expect(summary.title).toBe("Associate tokens");
    expect(summary.fields.find((f) => f.label === "Account")?.value).toBe(
      "0.0.1234",
    );
    expect(summary.fields.find((f) => f.label === "Tokens")?.value).toBe(
      "0.0.111, 0.0.222",
    );
  });

  it("should format submit_topic_message_tool with topic id and message", () => {
    const summary = summarize("submit_topic_message_tool", {
      topicId: "0.0.42",
      message: "hello world",
    });

    expect(summary.title).toBe("Submit topic message");
    expect(summary.fields).toEqual([
      { label: "Topic", value: "0.0.42" },
      { label: "Message", value: "hello world" },
    ]);
  });

  it("should truncate very long submit_topic_message_tool messages", () => {
    const longMessage = "a".repeat(500);

    const summary = summarize("submit_topic_message_tool", {
      topicId: "0.0.42",
      message: longMessage,
    });

    const message = summary.fields.find((f) => f.label === "Message");
    expect(message?.value.length).toBeLessThanOrEqual(240);
    expect(message?.value.endsWith("…")).toBe(true);
  });

  it("should format transfer_non_fungible_token_tool with serial → recipient lines", () => {
    const summary = summarize("transfer_non_fungible_token_tool", {
      tokenId: "0.0.999",
      recipients: [
        { recipientId: "0.0.2002", serialNumber: 1 },
        { recipientId: "0.0.3003", serialNumber: 2 },
      ],
    });

    const transfers = summary.fields.find((f) => f.label === "Transfers");
    expect(transfers?.value).toContain("#1 → 0.0.2002");
    expect(transfers?.value).toContain("#2 → 0.0.3003");
  });

  it("should render the default formatter when no registry entry exists", () => {
    const summary = summarize("get_account_query_tool", {
      accountId: "0.0.1234",
      includeTokens: true,
    });

    expect(summary.title).toBe("Get account query");
    expect(summary.fields).toEqual([
      { label: "Account ID", value: "0.0.1234" },
      { label: "Include tokens", value: "true" },
    ]);
  });

  it("should default-format nested object inputs as pretty JSON values", () => {
    const summary = summarize("unknown_custom_tool", {
      payload: { foo: "bar", baz: 1 },
    });

    expect(summary.fields[0].label).toBe("Payload");
    expect(summary.fields[0].value).toContain('"foo": "bar"');
  });

  it("should fall back to the default formatter when a registered formatter throws", () => {
    // Force a formatter failure: tokenIds is the wrong type for associate_token_tool.
    // The default formatter should still produce a usable summary.
    const summary = summarize("associate_token_tool", {
      accountId: 12345,
      tokenIds: null,
    });

    expect(summary.title).toBe("Associate tokens");
    expect(summary.fields.length).toBeGreaterThan(0);
  });

  it("should default-format an empty object input as an explicit (none) placeholder", () => {
    const summary = summarize("unknown_tool", {});

    expect(summary.title).toBe("Unknown");
    expect(summary.fields).toEqual([{ label: "Input", value: "(none)" }]);
  });

  it("should default-format a non-object input by surfacing the JSON form", () => {
    const summary = summarize("unknown_tool", "just a string");

    expect(summary.fields).toEqual([
      { label: "Input", value: '"just a string"' },
    ]);
  });

  it("should default-format a null input without throwing", () => {
    const summary = summarize("unknown_tool", null);

    expect(summary.title).toBe("Unknown");
    expect(summary.fields).toEqual([{ label: "Input", value: "null" }]);
  });

  it("should register the documented set of high-traffic tools", () => {
    expect(Object.keys(transactionSummaries).sort()).toEqual(
      [
        "associate_token_tool",
        "create_fungible_token_tool",
        "create_topic_tool",
        "mint_fungible_token_tool",
        "submit_topic_message_tool",
        "transfer_hbar_tool",
        "transfer_non_fungible_token_tool",
      ].sort(),
    );
  });
});

describe("humanizeToolName", () => {
  it("should strip the _tool suffix and capitalize the first word", () => {
    expect(humanizeToolName("transfer_hbar_tool")).toBe("Transfer hbar");
  });

  it("should leave already-clean names untouched apart from capitalization", () => {
    expect(humanizeToolName("submit_topic_message_tool")).toBe(
      "Submit topic message",
    );
  });

  it("should return the original input when it doesn't match the expected shape", () => {
    expect(humanizeToolName("")).toBe("");
  });
});

describe("humanizeKey", () => {
  it("should split camelCase keys into space-separated words", () => {
    expect(humanizeKey("accountId")).toBe("Account ID");
  });

  it("should preserve known acronyms across casing", () => {
    expect(humanizeKey("nftSerialNumber")).toBe("NFT serial number");
  });

  it("should convert snake_case to space-separated words", () => {
    expect(humanizeKey("supply_type")).toBe("Supply type");
  });

  it("should return the original key when it can't be split", () => {
    expect(humanizeKey("")).toBe("");
  });
});
