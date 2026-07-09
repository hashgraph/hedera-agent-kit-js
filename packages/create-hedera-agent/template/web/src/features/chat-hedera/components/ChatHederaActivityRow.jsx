"use client";

import * as React from "react";
import { ExternalLink } from "lucide-react";

import { humanizeKey } from "@/features/chat/utils/humanize";
import { buildHashscanUrl as buildExplorerUrl } from "@/features/chat-hedera/utils/hashscan-url";
import { HEDERA_NETWORK } from "@/features/chat-hedera/utils/network";
import { summarize } from "@/features/chat-hedera/utils/transaction-summaries";

const AWAITING_APPROVAL_STATUS = "AWAITING_APPROVAL";
const REJECTED_STATUS = "REJECTED";
const SUCCESS_STATUSES = new Set(["SUCCESS", "OK"]);

export function ChatHederaActivityRow({
  toolName,
  input,
  output,
  state,
  errorMessage: substrateErrorMessage,
}) {
  const summary = React.useMemo(() => summarize(toolName, input), [toolName, input]);
  const outcome = React.useMemo(
    () => extractOutcome(state, output, substrateErrorMessage),
    [state, output, substrateErrorMessage],
  );
  const outputFields = React.useMemo(
    () => projectOutputFields(state, output, substrateErrorMessage),
    [state, output, substrateErrorMessage],
  );
  const hashscanUrl = buildHashscanUrl(outcome.transactionId, summary.hashscanPath);

  return (
    <>
      <FieldList title="Input" fields={summary.fields} />
      {outputFields.length > 0 ? (
        <FieldList title="Output" fields={outputFields} />
      ) : null}
      {outcome.transactionId ? (
        <div className="flex flex-col gap-0.5">
          <span className="text-muted-foreground text-[11px] uppercase tracking-wide">
            Tx ID
          </span>
          <span className="break-all font-mono">{outcome.transactionId}</span>
          {hashscanUrl ? (
            <a
              href={hashscanUrl}
              target="_blank"
              rel="noreferrer"
              className="text-primary mt-1 inline-flex items-center gap-1 font-medium hover:underline"
            >
              View on Hashscan <ExternalLink className="size-3" />
            </a>
          ) : null}
        </div>
      ) : null}
      {outcome.errorMessage ? (
        <p className="text-destructive">{outcome.errorMessage}</p>
      ) : null}
    </>
  );
}

function FieldList({ title, fields }) {
  if (fields.length === 0) return null;
  return (
    <div>
      <p className="text-muted-foreground mb-1 text-[11px] uppercase tracking-wide">
        {title}
      </p>
      <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1">
        {fields.map((field) => (
          <React.Fragment key={field.label}>
            <dt className="text-muted-foreground">{field.label}</dt>
            <dd className="break-words whitespace-pre-wrap font-mono">
              {field.value}
            </dd>
          </React.Fragment>
        ))}
      </dl>
    </div>
  );
}

function extractOutcome(state, output, substrateErrorMessage) {
  if (state === "output-error") {
    return { errorMessage: substrateErrorMessage };
  }
  if (state !== "output-available") return {};
  const parsed = parseToolOutput(output);
  if (!parsed) return {};
  const raw = isRecord(parsed.raw) ? parsed.raw : undefined;
  const status = resolveStatus(raw);
  const transactionId =
    typeof raw?.transactionId === "string" ? raw.transactionId : undefined;
  const humanMessage =
    typeof parsed.humanMessage === "string" ? parsed.humanMessage : undefined;
  const errorMessage = isFailureStatus(status) ? humanMessage : undefined;
  return { transactionId, errorMessage };
}

function projectOutputFields(state, output, substrateErrorMessage) {
  if (state === "output-error") {
    return substrateErrorMessage
      ? [{ label: "Error", value: substrateErrorMessage }]
      : [];
  }
  if (state !== "output-available") return [];
  const parsed = parseToolOutput(output);
  if (!parsed) {
    if (output === undefined || output === null) return [];
    const raw = typeof output === "string" ? output : stringify(output);
    return [{ label: "Output", value: raw }];
  }
  const fields = [];
  if (isRecord(parsed.raw)) {
    for (const [key, value] of Object.entries(parsed.raw)) {
      // Tx ID has a dedicated row (with the Hashscan link). Skip the duplicate.
      if (key === "transactionId") continue;
      if (!hasMeaningfulValue(value)) continue;
      fields.push({ label: humanizeKey(key), value: stringifyValue(value) });
    }
  }
  if (typeof parsed.humanMessage === "string" && parsed.humanMessage.length > 0) {
    fields.push({ label: "Message", value: parsed.humanMessage });
  }
  return fields;
}

function resolveStatus(raw) {
  if (!raw) return undefined;
  if (typeof raw.status === "string") return raw.status;
  if (typeof raw.error === "string" && raw.error.length > 0) return "FAILED";
  return undefined;
}

function isFailureStatus(status) {
  if (!status) return false;
  if (status === AWAITING_APPROVAL_STATUS) return false;
  if (status === REJECTED_STATUS) return false;
  return !SUCCESS_STATUSES.has(status);
}

function parseToolOutput(output) {
  if (typeof output === "string") {
    try {
      const parsed = JSON.parse(output);
      return isRecord(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  if (isRecord(output)) return output;
  return null;
}

function hasMeaningfulValue(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (isRecord(value)) return Object.keys(value).length > 0;
  return true;
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringifyValue(value) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return stringify(value);
}

function stringify(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function buildHashscanUrl(transactionId, hashscanPath) {
  return buildExplorerUrl({ network: HEDERA_NETWORK, transactionId, hashscanPath });
}
