import { describe, expect, it } from "vitest";

import { deriveActivity } from "@/features/chat/utils/agent-activity";
import { fixtureToolSummarizers } from "@/features/chat/utils/test-fixtures";

// Wrap the substrate's `deriveActivity` with the local summarizer fixtures so
// every assertion below describes the substrate's behavior given a registered
// extension — without importing from any tool-family package.
function derive(input) {
  return deriveActivity(input, { toolSummarizers: fixtureToolSummarizers });
}

// Minimal ChatMessage factory: only `id`, `role`, and `parts` are read by the
// derivation module, so the tests construct messages directly without going
// through any runtime adapter.
function assistantMessage(parts) {
  return { id: "asst-1", role: "assistant", parts };
}

function textPart(text, state) {
  return { type: "text", text, state };
}

function toolPart(
  toolName,
  state = "output-available",
  input = {},
) {
  const part = {
    type: `tool-${toolName}`,
    toolName,
    toolCallId: `${toolName}-call`,
    state,
    input,
  };
  if (state === "output-available") part.output = "{}";
  if (state === "output-error") part.errorText = "boom";
  return part;
}

describe("deriveActivity", () => {
  describe("wait state", () => {
    it("should return wait when status is submitted and no assistant message exists", () => {
      const view = derive({ kind: "pending", status: "submitted" });

      expect(view).toEqual({ kind: "wait" });
    });

    it("should return hidden when pending but status is ready", () => {
      const view = derive({ kind: "pending", status: "ready" });

      expect(view).toEqual({ kind: "hidden" });
    });

    it("should return hidden when pending but status is streaming", () => {
      // Streaming with no message handed in is a transient race we don't render
      // a wait pulse for — once a message exists the per-message indicator takes
      // over. Keep the wait pulse strictly tied to `submitted`.
      const view = derive({ kind: "pending", status: "streaming" });

      expect(view).toEqual({ kind: "hidden" });
    });

    it("should return hidden when pending and status is error", () => {
      const view = derive({ kind: "pending", status: "error" });

      expect(view).toEqual({ kind: "hidden" });
    });
  });

  describe("progress state", () => {
    it("should return progress with Thinking… when live message is empty", () => {
      const view = derive({
        kind: "message",
        message: assistantMessage([]),
        isLive: true,
        status: "streaming",
      });

      expect(view).toEqual({
        kind: "progress",
        label: "Thinking…",
        stepCount: 0,
      });
    });

    it("should derive the progress label from the injected summarizer when a tool input is available", () => {
      const view = derive({
        kind: "message",
        message: assistantMessage([
          toolPart("transfer_hbar_tool", "input-available", {
            transfers: [{ accountId: "0.0.1234", amount: "5" }],
          }),
        ]),
        isLive: true,
        status: "streaming",
      });

      expect(view).toEqual({
        kind: "progress",
        label: "Transfer HBAR…",
        stepCount: 1,
      });
    });

    it("should derive the progress label from the injected summarizer while a tool input is streaming", () => {
      // input-streaming carries a partial DeepPartial input — the fixture's
      // formatters tolerate missing fields and the indicator picks up the label
      // as soon as the title is determinable from the tool name alone.
      const view = derive({
        kind: "message",
        message: assistantMessage([
          toolPart("create_fungible_token_tool", "input-streaming", {
            tokenName: "Demo",
          }),
        ]),
        isLive: true,
        status: "streaming",
      });

      expect(view).toEqual({
        kind: "progress",
        label: "Create fungible token…",
        stepCount: 1,
      });
    });

    it("should fall back to a humanized tool name when the tool has no fixture entry", () => {
      const view = derive({
        kind: "message",
        message: assistantMessage([toolPart("get_balance", "input-available")]),
        isLive: true,
        status: "streaming",
      });

      expect(view).toEqual({
        kind: "progress",
        label: "Get balance…",
        stepCount: 1,
      });
    });

    it("should fall back to Thinking… when the last tool part has completed and no further part exists", () => {
      // After a tool's output lands, the loop briefly has no active part before
      // the next tool call or the final reply starts streaming. The label
      // returns to the phase-level Thinking… in that gap.
      const view = derive({
        kind: "message",
        message: assistantMessage([
          toolPart("transfer_hbar_tool", "output-available"),
        ]),
        isLive: true,
        status: "streaming",
      });

      expect(view).toEqual({
        kind: "progress",
        label: "Thinking…",
        stepCount: 1,
      });
    });

    it("should return progress with Writing response… when text streams after a tool ran", () => {
      const view = derive({
        kind: "message",
        message: assistantMessage([
          toolPart("get_balance", "output-available"),
          textPart("Your balance is", "streaming"),
        ]),
        isLive: true,
        status: "streaming",
      });

      expect(view).toEqual({
        kind: "progress",
        label: "Writing response…",
        stepCount: 1,
      });
    });

    it("should return progress with Thinking… when text streams with no prior tools", () => {
      // Text-only turn: model is producing exploratory text and could still
      // call a tool. "Writing response…" is reserved for the final reply.
      const view = derive({
        kind: "message",
        message: assistantMessage([textPart("Hi there", "streaming")]),
        isLive: true,
        status: "streaming",
      });

      expect(view).toEqual({
        kind: "progress",
        label: "Thinking…",
        stepCount: 0,
      });
    });

    it("should treat submitted status as progress when an assistant message exists", () => {
      // AI SDK auto-resubmits after addToolResult and the status drops back to
      // submitted with the existing assistant message still around — the
      // indicator must stay in progress, not flip back to wait.
      const view = derive({
        kind: "message",
        message: assistantMessage([toolPart("get_balance", "output-available")]),
        isLive: true,
        status: "submitted",
      });

      expect(view).toMatchObject({ kind: "progress", stepCount: 1 });
    });

    it("should count multiple tool parts in the step count", () => {
      const view = derive({
        kind: "message",
        message: assistantMessage([
          toolPart("get_balance", "output-available"),
          toolPart("transfer_hbar", "input-available"),
        ]),
        isLive: true,
        status: "streaming",
      });

      expect(view).toMatchObject({ kind: "progress", stepCount: 2 });
    });
  });

  describe("resting state", () => {
    it("should return resting with the tool-part count when status is ready and tools ran", () => {
      const view = derive({
        kind: "message",
        message: assistantMessage([
          toolPart("get_balance", "output-available"),
          toolPart("transfer_hbar", "output-available"),
          textPart("Done.", "done"),
        ]),
        isLive: true,
        status: "ready",
      });

      expect(view).toEqual({ kind: "resting", stepCount: 2 });
    });

    it("should return hidden when status is ready and no tools ran", () => {
      const view = derive({
        kind: "message",
        message: assistantMessage([textPart("Hello!", "done")]),
        isLive: true,
        status: "ready",
      });

      expect(view).toEqual({ kind: "hidden" });
    });

    it("should return resting for a past message regardless of live status", () => {
      // Past messages always resolve to resting/hidden — they ignore the
      // current chat status because they aren't the live turn.
      const view = derive({
        kind: "message",
        message: assistantMessage([toolPart("get_balance", "output-available")]),
        isLive: false,
        status: "streaming",
      });

      expect(view).toEqual({ kind: "resting", stepCount: 1 });
    });

    it("should return hidden for a past empty assistant message", () => {
      const view = derive({
        kind: "message",
        message: assistantMessage([textPart("Reply", "done")]),
        isLive: false,
        status: "ready",
      });

      expect(view).toEqual({ kind: "hidden" });
    });
  });

  describe("cancellation", () => {
    it("should mark resting cancelled when status returns to ready while a tool input is still streaming", () => {
      const view = derive({
        kind: "message",
        message: assistantMessage([
          toolPart("transfer_hbar_tool", "input-streaming", {
            transfers: [{ accountId: "0.0.1234", amount: "5" }],
          }),
        ]),
        isLive: true,
        status: "ready",
      });

      expect(view).toEqual({
        kind: "resting",
        stepCount: 1,
        cancelled: true,
      });
    });

    it("should mark resting cancelled when status returns to ready while final text is still streaming", () => {
      const view = derive({
        kind: "message",
        message: assistantMessage([
          toolPart("get_balance", "output-available"),
          textPart("Your balance is", "streaming"),
        ]),
        isLive: true,
        status: "ready",
      });

      expect(view).toEqual({
        kind: "resting",
        stepCount: 1,
        cancelled: true,
      });
    });

    it("should mark resting cancelled even when no tool ever ran", () => {
      // Stop clicked before any tool call — text part stayed in streaming state.
      // The chip still surfaces (with stepCount=0) so the cancellation is
      // visible to the indicator's lifecycle hold even though it has no
      // timeline rows to expand into.
      const view = derive({
        kind: "message",
        message: assistantMessage([textPart("Let me check", "streaming")]),
        isLive: true,
        status: "ready",
      });

      expect(view).toEqual({
        kind: "resting",
        stepCount: 0,
        cancelled: true,
      });
    });

    it("should not mark cancelled when a HITL approval is pending", () => {
      // The awaiting-approval part is in `output-available` (with the sentinel
      // status) — not a non-terminal state. Stop while HITL approval is pending
      // must not leave the timeline in a confusing intermediate state.
      const message = {
        id: "asst-1",
        role: "assistant",
        parts: [
          {
            type: "tool-transfer_hbar_tool",
            toolName: "transfer_hbar_tool",
            toolCallId: "transfer-call",
            state: "output-available",
            input: { transfers: [{ accountId: "0.0.1", amount: "5" }] },
            output: JSON.stringify({ raw: { status: "AWAITING_APPROVAL" } }),
          },
        ],
      };

      const view = derive({
        kind: "message",
        message,
        isLive: true,
        status: "ready",
      });

      expect(view).toEqual({ kind: "resting", stepCount: 1 });
    });

    it("should not mark cancelled on past messages", () => {
      // Past messages always resolve to plain resting/hidden — the cancellation
      // signal is bound to the live turn lifecycle.
      const view = derive({
        kind: "message",
        message: assistantMessage([
          toolPart("transfer_hbar_tool", "input-streaming"),
        ]),
        isLive: false,
        status: "ready",
      });

      expect(view).toEqual({ kind: "resting", stepCount: 1 });
    });

    it("should not mark cancelled while the turn is still streaming", () => {
      // status === "streaming" means the agent is mid-flight — the row should
      // remain in progress, not flip to a cancelled resting state.
      const view = derive({
        kind: "message",
        message: assistantMessage([
          toolPart("transfer_hbar_tool", "input-streaming"),
        ]),
        isLive: true,
        status: "streaming",
      });

      expect(view.kind).toBe("progress");
    });
  });

  describe("resting-failed state", () => {
    it("should return resting-failed when the live turn errored", () => {
      const view = derive({
        kind: "message",
        message: assistantMessage([toolPart("get_balance", "output-available")]),
        isLive: true,
        status: "error",
        error: new Error("LLM API timeout"),
      });

      expect(view).toEqual({
        kind: "resting-failed",
        stepCount: 1,
        errorMessage: "LLM API timeout",
      });
    });

    it("should fall back to a generic message when the error has no message", () => {
      const view = derive({
        kind: "message",
        message: assistantMessage([]),
        isLive: true,
        status: "error",
        error: new Error(""),
      });

      expect(view).toEqual({
        kind: "resting-failed",
        stepCount: 0,
        errorMessage: "Agent error",
      });
    });

    it("should not surface failed state when error reference is null", () => {
      // useChat exposes `error` as `Error | undefined`; only when it's set does
      // the resting chip flip to the failed variant. Status alone is not
      // enough — the error reference is the authoritative signal.
      const view = derive({
        kind: "message",
        message: assistantMessage([toolPart("get_balance", "output-available")]),
        isLive: true,
        status: "error",
        error: null,
      });

      expect(view).toEqual({ kind: "resting", stepCount: 1 });
    });

    it("should not surface failed state on a past message", () => {
      // Errors are ephemeral and live on `useChat`. A past message never
      // resolves to resting-failed.
      const view = derive({
        kind: "message",
        message: assistantMessage([toolPart("get_balance", "output-available")]),
        isLive: false,
        status: "ready",
        error: new Error("stale"),
      });

      expect(view).toEqual({ kind: "resting", stepCount: 1 });
    });
  });

  describe("representative agent run", () => {
    it("should transition through wait → progress → resting across a tool-using turn", () => {
      const status = [];
      const transitions = [];

      // 1. User submits, no assistant message yet.
      status.push("submitted");
      transitions.push({
        label: "submitted, no message",
        view: derive({ kind: "pending", status: "submitted" }),
      });

      // 2. Assistant message minted, still streaming the first tool input.
      const inFlight = assistantMessage([
        toolPart("transfer_hbar_tool", "input-streaming", {
          transfers: [{ accountId: "0.0.1234", amount: "5" }],
        }),
      ]);
      transitions.push({
        label: "tool input streaming",
        view: derive({
          kind: "message",
          message: inFlight,
          isLive: true,
          status: "streaming",
        }),
      });

      // 3. Tool finishes, model starts streaming the final reply text.
      const writing = assistantMessage([
        toolPart("transfer_hbar_tool", "output-available"),
        textPart("Transferred 5 HBAR.", "streaming"),
      ]);
      transitions.push({
        label: "writing final reply",
        view: derive({
          kind: "message",
          message: writing,
          isLive: true,
          status: "streaming",
        }),
      });

      // 4. Turn completes.
      const done = assistantMessage([
        toolPart("transfer_hbar_tool", "output-available"),
        textPart("Transferred 5 HBAR.", "done"),
      ]);
      transitions.push({
        label: "completed",
        view: derive({
          kind: "message",
          message: done,
          isLive: true,
          status: "ready",
        }),
      });

      expect(transitions.map((t) => t.view)).toEqual([
        { kind: "wait" },
        { kind: "progress", label: "Transfer HBAR…", stepCount: 1 },
        { kind: "progress", label: "Writing response…", stepCount: 1 },
        { kind: "resting", stepCount: 1 },
      ]);
      // Sanity: the status sequence used above is the one useChat actually
      // emits for a tool-using turn that completes cleanly.
      expect(status).toEqual(["submitted"]);
    });

    it("should transition wait → progress → resting+cancelled when the user clicks Stop mid-tool", () => {
      // 1. Submitted, no message.
      const submittedView = derive({
        kind: "pending",
        status: "submitted",
      });

      // 2. Tool input streaming.
      const inFlight = assistantMessage([
        toolPart("transfer_hbar_tool", "input-streaming", {
          transfers: [{ accountId: "0.0.1234", amount: "5" }],
        }),
      ]);
      const progressView = derive({
        kind: "message",
        message: inFlight,
        isLive: true,
        status: "streaming",
      });

      // 3. User clicks Stop — status flips back to ready while the part is
      // still in input-streaming. The view becomes resting+cancelled and the
      // step count carries through so the chip reads `1 step`.
      const cancelledView = derive({
        kind: "message",
        message: inFlight,
        isLive: true,
        status: "ready",
      });

      expect([submittedView, progressView, cancelledView]).toEqual([
        { kind: "wait" },
        { kind: "progress", label: "Transfer HBAR…", stepCount: 1 },
        { kind: "resting", stepCount: 1, cancelled: true },
      ]);
    });

    it("should transition Thinking… → per-tool labels in stream order → Writing response… across a chained run", () => {
      // Phase 1: empty assistant message — model is still deciding.
      const empty = assistantMessage([]);
      // Phase 2: first tool's input begins streaming.
      const firstToolStreaming = assistantMessage([
        toolPart("transfer_hbar_tool", "input-streaming", {
          transfers: [{ accountId: "0.0.1234", amount: "5" }],
        }),
      ]);
      // Phase 3: first tool completed; second tool's input is now available.
      const secondToolPending = assistantMessage([
        toolPart("transfer_hbar_tool", "output-available"),
        toolPart("create_fungible_token_tool", "input-available", {
          tokenName: "Demo",
        }),
      ]);
      // Phase 4: both tools completed; final reply text is streaming.
      const finalText = assistantMessage([
        toolPart("transfer_hbar_tool", "output-available"),
        toolPart("create_fungible_token_tool", "output-available"),
        textPart("All done.", "streaming"),
      ]);

      const labels = [empty, firstToolStreaming, secondToolPending, finalText].map(
        (message) =>
          derive({
            kind: "message",
            message,
            isLive: true,
            status: "streaming",
          }),
      );

      expect(labels).toEqual([
        { kind: "progress", label: "Thinking…", stepCount: 0 },
        { kind: "progress", label: "Transfer HBAR…", stepCount: 1 },
        { kind: "progress", label: "Create fungible token…", stepCount: 2 },
        { kind: "progress", label: "Writing response…", stepCount: 2 },
      ]);
    });
  });
});
