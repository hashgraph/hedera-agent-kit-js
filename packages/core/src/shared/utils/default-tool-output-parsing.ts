/**
 * Shared status constants for the `raw.status` field.
 *
 * Using this object at every write site (instead of bare string literals) gives
 * compile-time protection against typos
 *
 * | Value          | Set by                                                                                          |
 * |----------------|-------------------------------------------------------------------------------------------------|
 * | `SUCCESS`      | `BaseTool.execute()` (defaulted for any tool that reaches the end without an explicit status),  |
 * |                | `ReturnBytesStrategy`, and `ExecuteStrategy` (receipt is always `SUCCESS` here — non-SUCCESS    |
 * |                | receipts throw before the return).                                                              |
 * | `ERROR`        | `BaseTransactionTool.handleError()` (receipt/precheck failures) or `BaseTool.handleError()`    |
 * |                | (generic). Receipt/precheck failures additionally set `raw.errorCode` (SDK status name, e.g.   |
 * |                | `'INSUFFICIENT_PAYER_BALANCE'`) and `raw.transactionId`.                                        |
 * | `PARSE_ERROR`  | `transactionToolOutputParser` / `untypedQueryOutputParser` when the output is malformed.        |
 */
export const TOOL_STATUS = {
  SUCCESS: 'SUCCESS',
  ERROR: 'ERROR',
  PARSE_ERROR: 'PARSE_ERROR',
} as const;

/**
 * Well-known string values that appear in `raw.status` across all tool outputs.
 * Derived from {@link TOOL_STATUS} so the type and the runtime values are always in sync.
 *
 * Use {@link classifyToolResult} to map these into the stable
 * `ToolResultStatus` discriminated union (`success | failure | parse_error | unknown`).
 */
export type ToolRawStatus = (typeof TOOL_STATUS)[keyof typeof TOOL_STATUS];

/**
 * Parse a transaction tool's JSON output into a normalized shape.
 *
 * Accepts a stringified JSON `rawOutput` produced by a transaction tool and
 * returns a consistent `{ raw: any, humanMessage: string }` object.
 *
 * Behavior:
 * - If `rawOutput` is not valid JSON, returns a `raw` object with
 *   `{ status: 'PARSE_ERROR', error, originalOutput }` and a generic error
 *   `humanMessage`.
 * - If the parsed object has a top-level `bytes` field (RETURN_BYTES /
 *   CUSTOM_RETURN_BYTES mode), the parsed object is returned as `raw` and a
 *   default human-friendly message is provided.
 * - If the parsed object contains both `raw` and `humanMessage` (EXECUTE_TRANSACTION
 *   mode), any additional top-level fields are merged into the returned `raw`
 *   object so extra tool information is preserved.
 * - For any other shape, returns a `PARSE_ERROR` indicating an unexpected format.
 *
 * @param rawOutput - JSON string output from a transaction tool
 * @returns An object containing the untyped `raw` tool data and a `humanMessage`
 */
export const transactionToolOutputParser = (
  rawOutput: string,
): { raw: any; humanMessage: string } => {
  let parsedObject;
  try {
    parsedObject = JSON.parse(rawOutput);
  } catch (error) {
    console.error(`[transactionToolOutputParser] Failed to parse JSON:`, rawOutput, error);
    return {
      raw: { status: TOOL_STATUS.PARSE_ERROR, error: error, originalOutput: rawOutput },
      humanMessage: 'Error: Failed to parse tool output. The output was malformed.',
    };
  }

  // Case 1: Handle RETURN_BYTES / CUSTOM_RETURN_BYTES mode output
  if (parsedObject && parsedObject.bytes) {
    return {
      raw: parsedObject, // The 'raw' data *is* the object with the bytes
      humanMessage: 'Transaction bytes are ready for signing.', // The parser can add a helpful default message
    };
  }

  // Case 2: Handle EXECUTE_TRANSACTION mode output
  if (
    parsedObject &&
    typeof parsedObject.raw !== 'undefined' &&
    typeof parsedObject.humanMessage !== 'undefined'
  ) {
    const { raw, humanMessage, ...otherFields } = parsedObject;

    // This ensures any extra data from the tool is not lost
    // It will be merged into the 'raw' object returned
    const mergedRaw = { ...raw, ...otherFields };

    return {
      raw: mergedRaw,
      humanMessage: humanMessage,
    };
  }

  // Fallback for anything else
  console.error(`[transactionToolOutputParser] Parsed object has unknown shape:`, parsedObject);
  return {
    raw: { status: TOOL_STATUS.PARSE_ERROR, originalOutput: rawOutput, parsedObject },
    humanMessage: 'Error: Parsed tool output had an unexpected format.',
  };
};

/**
 * A temporary, generic output parser for **all query tools**.
 * * This function provides a basic, untyped parsing mechanism for the
 * stringified JSON output from any query tool. It extracts the common
 * `{ raw: any, humanMessage: string }` structure.
 * * @remarks
 * This is a temporary, "one-size-fits-all" solution.
 * The long-term goal is to replace this with **specific, strongly-typed
 * output parsers for each individual query tool**. This will allow
 * for better compile-time type-checking and more robust handling of
 * each tool's unique `raw` data structure (e.g., `AccountResponse`,
 * `TokenInfoResponse`, etc.).
 *
 * @param rawOutput The stringified JSON content from a query tool's ToolMessage.
 * @returns A JavaScript object with 'raw' and 'humanMessage' keys.
 */
export const untypedQueryOutputParser = (rawOutput: string): { raw: any; humanMessage: string } => {
  let parsedObject;
  try {
    parsedObject = JSON.parse(rawOutput);
  } catch (error) {
    console.error(`untypedQueryOutputParser failed to parse JSON:`, error);
    return {
      raw: { status: TOOL_STATUS.PARSE_ERROR, error: error, originalOutput: rawOutput },
      humanMessage: 'Error: Failed to parse tool output. The output was malformed.',
    };
  }

  // Basic check to ensure the common structure is present
  if (
    !parsedObject ||
    typeof parsedObject.raw === 'undefined' ||
    typeof parsedObject.humanMessage === 'undefined'
  ) {
    console.error(
      `untypedQueryOutputParser: Parsed object missing 'raw' or 'humanMessage' key:`,
      parsedObject,
    );
    return {
      raw: {
        status: TOOL_STATUS.PARSE_ERROR,
        error: "Parsed object missing 'raw' or 'humanMessage'",
        originalOutput: rawOutput,
      },
      humanMessage: 'Error: Tool output had an unexpected format.',
    };
  }

  return {
    // The 'raw' data is the untyped JSON object from the tool.
    // This generic parser just passes it through. A future, tool-specific
    // parser would validate and cast this 'raw' object into a specific type.
    raw: parsedObject.raw,
    humanMessage: parsedObject.humanMessage,
  };
};

/**
 * Discriminated union describing a tool result that has been classified into
 * a stable success / failure / parse_error / unknown shape.
 *
 * - `success`: `raw.status === 'SUCCESS'`. `data` exposes the original `raw`
 *   payload typed as `T`. `transactionId` is lifted out when present.
 * - `failure`: `raw.status === 'ERROR'` or `raw.error` is a string. `errorCode`
 *   is the specific SDK status name (e.g. `'INSUFFICIENT_PAYER_BALANCE'`) when
 *   the failure was a Hedera network receipt or precheck error, or `'ERROR'` for
 *   generic caught exceptions. `transactionId` is lifted out when present
 *   (receipt and precheck failures both set it).
 * - `parse_error`: `raw.status === 'PARSE_ERROR'` or the envelope was
 *   structurally malformed (missing `raw`, non-object, etc.).
 * - `unknown`: `raw.status` is a non-empty string that does not match any of
 *   the above (e.g. an unexpected Hedera SDK status from `ExecuteStrategy`).
 *
 * See {@link ToolRawStatus} for the known `raw.status` string values and
 * {@link BaseTool} for the full `raw.status` contract.
 */
export type ToolResultStatus<T = unknown> =
  | { kind: 'success'; transactionId?: string; data: T; humanMessage: string }
  | {
      kind: 'failure';
      errorCode: string;
      transactionId?: string;
      error: string;
      humanMessage: string;
    }
  | { kind: 'parse_error'; originalOutput: unknown; humanMessage: string }
  | { kind: 'unknown'; humanMessage: string };

/**
 * Classify the `{ raw, humanMessage }` envelope returned by
 * {@link transactionToolOutputParser} or {@link untypedQueryOutputParser}
 * into a typed, discriminated `ToolResultStatus<T>`.
 *
 * This is an **additive, opt-in** helper. Existing parsers continue to return
 * `{ raw: any; humanMessage: string }` unchanged. Consumers that want a
 * single, type-safe surface for branching on success vs. failure can pass
 * that envelope here and `switch` on `kind`.
 *
 * @example
 * ```ts
 * const envelope = transactionToolOutputParser(rawOutput);
 * const result = classifyToolResult<{ transactionId: string; topicId?: string }>(envelope);
 * switch (result.kind) {
 *   case 'success':
 *     return { txId: result.transactionId, topicId: result.data.topicId };
 *   case 'failure':
 *     throw new Error(`tool failed (${result.errorCode}): ${result.error}`);
 *   case 'parse_error':
 *     throw new Error(`tool output unparseable: ${result.humanMessage}`);
 * }
 * ```
 *
 * @param parsed The envelope returned by one of the default tool parsers.
 * @returns A `ToolResultStatus<T>` tagged union safe to `switch` on.
 */
export const classifyToolResult = <T = unknown>(parsed: {
  raw: any;
  humanMessage: string;
}): ToolResultStatus<T> => {
  const { raw, humanMessage } = parsed;

  if (raw == null || typeof raw !== 'object') {
    return {
      kind: 'parse_error',
      originalOutput: raw,
      humanMessage: humanMessage || 'Error: Tool output had an unexpected format.',
    };
  }

  if (raw.status === TOOL_STATUS.PARSE_ERROR) {
    return {
      kind: 'parse_error',
      originalOutput: 'originalOutput' in raw ? raw.originalOutput : raw,
      humanMessage,
    };
  }

  if (raw.status === TOOL_STATUS.SUCCESS) {
    return {
      kind: 'success',
      transactionId: typeof raw.transactionId === 'string' ? raw.transactionId : undefined,
      data: raw as T,
      humanMessage,
    };
  }

  if (raw.status === TOOL_STATUS.ERROR || typeof raw.error === 'string') {
    return {
      kind: 'failure',
      // Prefer raw.errorCode (SDK status name, e.g. 'INSUFFICIENT_PAYER_BALANCE')
      // when present; fall back to raw.status ('ERROR') for generic errors.
      errorCode:
        typeof raw.errorCode === 'string'
          ? raw.errorCode
          : typeof raw.status === 'string'
            ? raw.status
            : 'UNKNOWN',
      transactionId: typeof raw.transactionId === 'string' ? raw.transactionId : undefined,
      error: typeof raw.error === 'string' ? raw.error : humanMessage,
      humanMessage,
    };
  }

  return { kind: 'unknown', humanMessage };
};
