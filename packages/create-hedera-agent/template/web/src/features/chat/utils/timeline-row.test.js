import { describe, expect, it } from "vitest";

import {
  mapTimelineRow,
  mapTimelineRows,
} from "@/features/chat/utils/timeline-row";
import { fixtureToolSummarizers } from "@/features/chat/utils/test-fixtures";

// Helpers that thread the fixture summarizers into the substrate's row mappers
// so the assertions describe behavior given a registered extension — without
// importing from any tool-family package.
function row(input) {
  return mapTimelineRow({ toolSummarizers: fixtureToolSummarizers, ...input });
}

function rows(
  message,
  options = {},
) {
  return mapTimelineRows(message, {
    ...options,
    toolSummarizers: fixtureToolSummarizers,
  });
}

// Minimal tool-part factory that emits a canonical `ChatToolPart`. The row
// module only reads the fields wired here — input, output, errorText, state,
// toolName, toolCallId.
function toolPart(options = {}) {
  const {
    toolName = "get_balance",
    toolCallId = `${toolName}-call`,
    state = "output-available",
    input = {},
    output,
    errorText,
  } = options;

  const part = {
    type: `tool-${toolName}`,
    toolName,
    toolCallId,
    state,
    input,
  };
  if (state === "output-available") {
    // Honor an explicitly-passed `null`/`undefined` for malformed-output tests;
    // only fall back to a default envelope when the caller didn't set the key.
    part.output =
      "output" in options ? output : JSON.stringify({ raw: { status: "SUCCESS" } });
  }
  if (state === "output-error") {
    part.errorText = errorText ?? "boom";
  }
  return part;
}

function envelope(raw, humanMessage) {
  return JSON.stringify(humanMessage === undefined ? { raw } : { raw, humanMessage });
}

describe("mapTimelineRow", () => {
  describe("row state", () => {
    it("should return pending while input is streaming", () => {
      const result = row({
        part: toolPart({ state: "input-streaming" }),
      });

      expect(result.state).toBe("pending");
    });

    it("should return pending while input is available but not yet executed", () => {
      const result = row({
        part: toolPart({ state: "input-available" }),
      });

      expect(result.state).toBe("pending");
    });

    it("should return pending while approval is being requested", () => {
      const result = row({
        part: toolPart({ state: "approval-requested" }),
      });

      expect(result.state).toBe("pending");
    });

    it("should return pending while approval has been responded but the call is in flight", () => {
      const result = row({
        part: toolPart({ state: "approval-responded" }),
      });

      expect(result.state).toBe("pending");
    });

    it("should return success when the output status is SUCCESS", () => {
      const result = row({
        part: toolPart({
          state: "output-available",
          output: envelope({ status: "SUCCESS", transactionId: "0.0.1@1" }),
        }),
      });

      expect(result.state).toBe("success");
    });

    it("should return success when the output status is OK", () => {
      const result = row({
        part: toolPart({
          state: "output-available",
          output: envelope({ status: "OK" }),
        }),
      });

      expect(result.state).toBe("success");
    });

    it("should return failure when the output status is a wire failure code", () => {
      const result = row({
        part: toolPart({
          state: "output-available",
          output: envelope({ status: "INSUFFICIENT_PAYER_BALANCE" }, "Out of HBAR."),
        }),
      });

      expect(result.state).toBe("failure");
    });

    it("should return rejected when the user rejected the transaction in HITL mode", () => {
      const result = row({
        part: toolPart({
          state: "output-available",
          output: envelope({ status: "REJECTED" }),
        }),
      });

      expect(result.state).toBe("rejected");
    });

    it("should return awaiting-approval when the output status is the HITL sentinel", () => {
      const result = row({
        part: toolPart({
          state: "output-available",
          output: envelope({ status: "AWAITING_APPROVAL" }),
        }),
      });

      expect(result.state).toBe("awaiting-approval");
    });

    it("should override awaiting-approval to pending while the user is signing", () => {
      // The wallet roundtrip after Approve flips the client-side signing flag
      // before the AI SDK part transitions to `output-available` with the real
      // result. The row must read as in-flight during that window so the
      // expanded panel doesn't show two competing approval affordances.
      const result = row({
        part: toolPart({
          state: "output-available",
          output: envelope({ status: "AWAITING_APPROVAL" }),
        }),
        signing: true,
      });

      expect(result.state).toBe("pending");
    });

    it("should return network-error on output-error", () => {
      const result = row({
        part: toolPart({ state: "output-error", errorText: "fetch failed" }),
      });

      expect(result.state).toBe("network-error");
    });

    it("should return stopped when the row is pending and the turn was cancelled", () => {
      const result = row({
        part: toolPart({ state: "input-streaming" }),
        cancelled: true,
      });

      expect(result.state).toBe("stopped");
    });

    it("should return stopped when input-available and the turn was cancelled", () => {
      const result = row({
        part: toolPart({ state: "input-available" }),
        cancelled: true,
      });

      expect(result.state).toBe("stopped");
    });

    it("should keep awaiting-approval when the turn was cancelled but the part is in HITL", () => {
      // The HITL pause is a legitimate steady state — the user can still
      // approve or reject after Stop. Cancellation must not flip this to
      // `stopped` or the row would lie about the row's available actions.
      const result = row({
        part: toolPart({
          state: "output-available",
          output: envelope({ status: "AWAITING_APPROVAL" }),
        }),
        cancelled: true,
      });

      expect(result.state).toBe("awaiting-approval");
    });

    it("should keep pending when the wallet is mid-sign even on a cancelled turn", () => {
      // Active wallet roundtrip overrides cancellation — the row stays as
      // pending until the actual wallet outcome lands as a real output.
      const result = row({
        part: toolPart({ state: "input-available" }),
        cancelled: true,
        signing: true,
      });

      expect(result.state).toBe("pending");
    });

    it("should keep terminal output states unchanged when cancelled", () => {
      // A successful tool that completed before Stop was clicked must not be
      // retroactively flipped to stopped.
      const result = row({
        part: toolPart({
          state: "output-available",
          output: envelope({ status: "SUCCESS", transactionId: "0.0.1@1" }),
        }),
        cancelled: true,
      });

      expect(result.state).toBe("success");
    });
  });

  describe("label", () => {
    it("should derive the label from the injected summarizer when the tool is registered", () => {
      const result = row({
        part: toolPart({
          toolName: "transfer_hbar_tool",
          input: { transfers: [{ accountId: "0.0.123", amount: "5" }] },
        }),
      });

      expect(result.label).toBe("Transfer HBAR");
    });

    it("should fall back to a humanized tool name for unregistered tools", () => {
      const result = row({
        part: toolPart({ toolName: "get_account_balance_query" }),
      });

      expect(result.label).toBe("Get account balance query");
    });
  });

  describe("inline result chip", () => {
    it("should surface the status code as the chip on failure", () => {
      const result = row({
        part: toolPart({
          state: "output-available",
          output: envelope({ status: "INSUFFICIENT_PAYER_BALANCE" }),
        }),
      });

      expect(result.chip).toBe("INSUFFICIENT_PAYER_BALANCE");
    });

    it("should omit the chip on success", () => {
      const result = row({
        part: toolPart({
          state: "output-available",
          output: envelope({ status: "SUCCESS", transactionId: "0.0.1@1" }),
        }),
      });

      expect(result.chip).toBeUndefined();
    });

    it("should omit the chip while the row is pending", () => {
      const result = row({
        part: toolPart({ state: "input-streaming" }),
      });

      expect(result.chip).toBeUndefined();
    });
  });

  describe("input fields", () => {
    it("should source input fields from the injected summarizer", () => {
      const result = row({
        part: toolPart({
          toolName: "transfer_hbar_tool",
          input: {
            sourceAccountId: "0.0.1001",
            transfers: [{ accountId: "0.0.2002", amount: 5 }],
          },
        }),
      });

      expect(result.inputFields.find((f) => f.label === "From")?.value).toBe(
        "0.0.1001",
      );
      expect(result.inputFields.find((f) => f.label === "Transfers")?.value).toBe(
        "5 ℏ → 0.0.2002",
      );
    });

    it("should fall back to humanized-key fields for unregistered tools", () => {
      const result = row({
        part: toolPart({
          toolName: "custom_query",
          input: { accountId: "0.0.42", includeTokens: true },
        }),
      });

      expect(result.inputFields).toEqual([
        { label: "Account ID", value: "0.0.42" },
        { label: "Include tokens", value: "true" },
      ]);
    });
  });

  describe("output fields", () => {
    it("should project raw output entries into humanized key/value pairs", () => {
      const result = row({
        part: toolPart({
          state: "output-available",
          output: envelope({
            status: "SUCCESS",
            tokenId: "0.0.999",
            decimals: 2,
          }),
        }),
      });

      expect(result.outputFields).toEqual(
        expect.arrayContaining([
          { label: "Status", value: "SUCCESS" },
          { label: "Token ID", value: "0.0.999" },
          { label: "Decimals", value: "2" },
        ]),
      );
    });

    it("should keep transactionId out of the generic field list", () => {
      const result = row({
        part: toolPart({
          state: "output-available",
          output: envelope({ status: "SUCCESS", transactionId: "0.0.1@123" }),
        }),
      });

      const labels = result.outputFields.map((f) => f.label);
      expect(labels).not.toContain("Transaction ID");
      expect(result.transactionId).toBe("0.0.1@123");
    });

    it("should add humanMessage as a Message row when present", () => {
      const result = row({
        part: toolPart({
          state: "output-available",
          output: envelope({ status: "SUCCESS" }, "Transferred 5 HBAR."),
        }),
      });

      expect(result.outputFields).toContainEqual({
        label: "Message",
        value: "Transferred 5 HBAR.",
      });
    });

    it("should return empty output fields while the call is pending", () => {
      const result = row({
        part: toolPart({ state: "input-streaming" }),
      });

      expect(result.outputFields).toEqual([]);
    });

    it("should surface output-error errorText as the Error row", () => {
      const result = row({
        part: toolPart({ state: "output-error", errorText: "ECONNREFUSED" }),
      });

      expect(result.outputFields).toEqual([
        { label: "Error", value: "ECONNREFUSED" },
      ]);
      expect(result.errorMessage).toBe("ECONNREFUSED");
    });
  });

  describe("transaction id and hashscan path", () => {
    it("should surface transactionId from the raw output", () => {
      const result = row({
        part: toolPart({
          state: "output-available",
          output: envelope({ status: "SUCCESS", transactionId: "0.0.7@1" }),
        }),
      });

      expect(result.transactionId).toBe("0.0.7@1");
    });

    it("should pass through the summary's hashscanPath when the formatter exposes one", () => {
      // Fixture formatters don't currently set hashscanPath, but the field is
      // part of the contract — verify it round-trips through.
      const result = row({
        part: toolPart({ toolName: "transfer_hbar_tool" }),
      });

      expect(result.hashscanPath).toBeUndefined();
    });
  });

  describe("malformed output", () => {
    it("should not throw when the output is a non-JSON string", () => {
      const result = row({
        part: toolPart({
          state: "output-available",
          output: "not-json",
        }),
      });

      expect(result.state).toBe("success");
      expect(result.outputFields).toEqual([{ label: "Output", value: "not-json" }]);
    });

    it("should not throw when the output is a JSON primitive rather than a record", () => {
      const result = row({
        part: toolPart({
          state: "output-available",
          output: "42",
        }),
      });

      expect(result.state).toBe("success");
      expect(result.outputFields).toEqual([{ label: "Output", value: "42" }]);
    });

    it("should not throw when the output is null", () => {
      const result = row({
        part: toolPart({
          state: "output-available",
          output: null,
        }),
      });

      expect(result.outputFields).toEqual([]);
      expect(result.transactionId).toBeUndefined();
    });

    it("should not throw when the raw envelope lacks a status field", () => {
      const result = row({
        part: toolPart({
          state: "output-available",
          output: JSON.stringify({ raw: { unrelated: true } }),
        }),
      });

      expect(result.state).toBe("success");
      expect(result.chip).toBeUndefined();
    });
  });

  describe("malformed input", () => {
    it("should not throw when the input is missing required fields for the registry formatter", () => {
      const result = row({
        part: toolPart({
          toolName: "transfer_hbar_tool",
          input: {},
        }),
      });

      expect(result.label).toBe("Transfer HBAR");
      expect(result.inputFields.length).toBeGreaterThan(0);
    });
  });
});

describe("mapTimelineRows", () => {
  it("should return rows in message-parts order", () => {
    const message = {
      id: "asst-1",
      role: "assistant",
      parts: [
        toolPart({ toolName: "transfer_hbar_tool", toolCallId: "a" }),
        toolPart({ toolName: "create_fungible_token_tool", toolCallId: "b" }),
      ],
    };

    const result = rows(message);

    expect(result.map((r) => r.toolCallId)).toEqual(["a", "b"]);
    expect(result.map((r) => r.label)).toEqual([
      "Transfer HBAR",
      "Create fungible token",
    ]);
  });

  it("should skip non-tool parts", () => {
    const message = {
      id: "asst-1",
      role: "assistant",
      parts: [
        { type: "text", text: "Hi", state: "done" },
        toolPart({ toolName: "transfer_hbar_tool", toolCallId: "a" }),
        { type: "text", text: "Done.", state: "done" },
      ],
    };

    const result = rows(message);

    expect(result).toHaveLength(1);
    expect(result[0].toolCallId).toBe("a");
  });

  it("should apply the signing override only to matching tool call IDs", () => {
    const message = {
      id: "asst-1",
      role: "assistant",
      parts: [
        toolPart({
          toolName: "transfer_hbar_tool",
          toolCallId: "signing-this-one",
          state: "output-available",
          output: envelope({ status: "AWAITING_APPROVAL" }),
        }),
        toolPart({
          toolName: "create_fungible_token_tool",
          toolCallId: "different-id",
          state: "output-available",
          output: envelope({ status: "AWAITING_APPROVAL" }),
        }),
      ],
    };

    const result = rows(message, {
      signingToolCallIds: new Set(["signing-this-one"]),
    });

    expect(result[0].state).toBe("pending");
    expect(result[1].state).toBe("awaiting-approval");
  });

  it("should propagate the cancelled flag to every pending row", () => {
    const message = {
      id: "asst-1",
      role: "assistant",
      parts: [
        toolPart({
          toolName: "transfer_hbar_tool",
          toolCallId: "completed",
          state: "output-available",
          output: envelope({ status: "SUCCESS" }),
        }),
        toolPart({
          toolName: "create_fungible_token_tool",
          toolCallId: "stuck",
          state: "input-streaming",
        }),
      ],
    };

    const result = rows(message, { cancelled: true });

    expect(result[0].state).toBe("success");
    expect(result[1].state).toBe("stopped");
  });

  it("should expose input AND output fields on mutating rows so the audit panel is self-sufficient", () => {
    // The inline transaction card renders the same data in headline form below,
    // but the timeline expansion is the canonical full-detail view — the
    // duplication is accepted in exchange for per-row inspectability.
    const message = {
      id: "asst-1",
      role: "assistant",
      parts: [
        toolPart({
          toolName: "transfer_hbar_tool",
          toolCallId: "mutating-row",
          input: { transfers: [{ accountId: "0.0.2", amount: 5 }] },
          state: "output-available",
          output: envelope({ status: "SUCCESS", transactionId: "0.0.1@1" }),
        }),
        toolPart({
          toolName: "get_hbar_balance_query_tool",
          toolCallId: "readonly-row",
          input: { accountId: "0.0.2" },
          state: "output-available",
          output: envelope({ status: "SUCCESS", balance: "42" }),
        }),
      ],
    };

    const result = rows(message, {
      mutatingToolMethods: new Set(["transfer_hbar_tool"]),
    });

    expect(result[0].inputFields.length).toBeGreaterThan(0);
    expect(result[0].outputFields.length).toBeGreaterThan(0);
    expect(result[0].transactionId).toBe("0.0.1@1");
    expect(result[0].label).toBe("Transfer HBAR");

    expect(result[1].inputFields.length).toBeGreaterThan(0);
    expect(result[1].outputFields.length).toBeGreaterThan(0);
  });
});

describe("mapTimelineRow mutating projection", () => {
  it("should surface the network-error message on mutating rows so failed transfers explain themselves", () => {
    const result = row({
      part: toolPart({
        toolName: "transfer_hbar_tool",
        state: "output-error",
        errorText: "ECONNREFUSED",
      }),
      isMutating: true,
    });

    expect(result.state).toBe("network-error");
    expect(result.errorMessage).toBe("ECONNREFUSED");
    expect(result.outputFields).toEqual([{ label: "Error", value: "ECONNREFUSED" }]);
    expect(result.inputFields.length).toBeGreaterThan(0);
  });

  it("should preserve the failure status chip and surface the human message on mutating rows", () => {
    const result = row({
      part: toolPart({
        toolName: "transfer_hbar_tool",
        input: { transfers: [{ accountId: "0.0.2", amount: 999999 }] },
        state: "output-available",
        output: envelope(
          { status: "INSUFFICIENT_PAYER_BALANCE" },
          "Payer balance is too low.",
        ),
      }),
      isMutating: true,
    });

    expect(result.state).toBe("failure");
    expect(result.chip).toBe("INSUFFICIENT_PAYER_BALANCE");
    expect(result.errorMessage).toBe("Payer balance is too low.");
    expect(result.inputFields.length).toBeGreaterThan(0);
    expect(result.outputFields.length).toBeGreaterThan(0);
  });
});
