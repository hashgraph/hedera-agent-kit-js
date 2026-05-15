import { humanizeKey, humanizeToolName } from "./humanize";
import type { ToolSummary, ToolSummarizer } from "@/features/chat/extension";

// Substrate fallback used whenever no registered extension owns a summarizer
// for the requested tool. Projects the raw input as a labeled field list with
// humanized keys, and falls back to a humanized form of the tool name as the
// title. Tolerates non-record inputs by stringifying them as a single field.
export function defaultSummarize(toolName: string, input: unknown): ToolSummary {
  const title = humanizeToolName(toolName);
  const record = isPlainRecord(input) ? input : null;
  if (!record) {
    return {
      title,
      fields: [{ label: "Input", value: stringifyInput(input) }],
    };
  }
  const fields = Object.entries(record).map(([key, value]) => ({
    label: humanizeKey(key),
    value: stringifyValue(value),
  }));
  return {
    title,
    fields: fields.length ? fields : [{ label: "Input", value: "(none)" }],
  };
}

// Looks up the per-tool summarizer in the merged registry. Falls back to the
// substrate default when the tool isn't registered, and on any thrown error
// inside an extension formatter so a malformed input never breaks the UI.
export function summarizeWithRegistry(
  registry: Readonly<Record<string, ToolSummarizer>>,
  toolName: string,
  input: unknown,
): ToolSummary {
  const formatter = registry[toolName];
  if (formatter) {
    try {
      return formatter(input);
    } catch {
      // Fall through to the substrate default.
    }
  }
  return defaultSummarize(toolName, input);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return stringifyInput(value);
}

function stringifyInput(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
