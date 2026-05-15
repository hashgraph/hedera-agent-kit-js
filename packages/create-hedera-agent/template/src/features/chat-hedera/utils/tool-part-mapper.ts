import type { ChatHederaTransactionCardState } from "./transaction-card-state";

// Hedera-side sentinel emitted in human mode for the HITL approval flow.
// Duplicated from `chat-hedera/server/` to keep the client free of server
// imports; the value is part of the JSON-on-the-wire contract.
export const AWAITING_APPROVAL_STATUS = "AWAITING_APPROVAL";

export type ToolOutcome = {
  transactionId?: string;
  status?: string;
  errorMessage?: string;
  unsignedBytes?: string;
};

export function mapToolPartState(
  state: string,
  outcome: ToolOutcome,
  isSigning: boolean,
): ChatHederaTransactionCardState {
  switch (state) {
    case "input-streaming":
    case "input-available":
    case "approval-requested":
    case "approval-responded":
      return "executing";
    case "output-available":
      if (outcome.status === AWAITING_APPROVAL_STATUS) {
        return isSigning ? "signing" : "awaiting-approval";
      }
      if (outcome.status === "REJECTED") {
        return "failed";
      }
      return isFailureStatus(outcome.status) ? "failed" : "confirmed";
    case "output-error":
      return "network-error";
    case "output-denied":
      return "failed";
    default:
      return "executing";
  }
}

export function extractOutcome(
  state: string,
  output: unknown,
  substrateErrorMessage: string | undefined,
): ToolOutcome {
  if (state === "output-error") {
    return { errorMessage: substrateErrorMessage };
  }
  if (state !== "output-available") {
    return {};
  }
  const parsed = parseToolOutput(output);
  if (!parsed) return {};
  const raw = isRecord(parsed.raw) ? parsed.raw : null;
  // The Hedera Agent Kit's `handleError` returns `{ raw: { status: SDK.Status,
  // error } }`. SDK Status is a frozen class that JSON-serializes as
  // `{ "_code": <n> }`, so a strict `typeof === "string"` check loses the
  // failure signal and the card would render as confirmed. Falling back to
  // `raw.error` recovers the failure, which always pairs with that envelope.
  let status: string | undefined;
  if (typeof raw?.status === "string") {
    status = raw.status;
  } else if (typeof raw?.error === "string" && raw.error.length > 0) {
    status = "FAILED";
  }
  const transactionId =
    typeof raw?.transactionId === "string" ? raw.transactionId : undefined;
  const errorMessage =
    isFailureStatus(status) && typeof parsed.humanMessage === "string"
      ? parsed.humanMessage
      : undefined;
  const unsignedBytes =
    typeof raw?.unsignedBytes === "string" ? raw.unsignedBytes : undefined;
  return { transactionId, status, errorMessage, unsignedBytes };
}

function parseToolOutput(
  output: unknown,
): { raw?: unknown; humanMessage?: unknown } | null {
  if (typeof output === "string") {
    try {
      return JSON.parse(output);
    } catch {
      return null;
    }
  }
  if (isRecord(output)) return output;
  return null;
}

function isFailureStatus(status: string | undefined): boolean {
  if (!status) return false;
  if (status === AWAITING_APPROVAL_STATUS) return false;
  return status !== "SUCCESS" && status !== "OK";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
