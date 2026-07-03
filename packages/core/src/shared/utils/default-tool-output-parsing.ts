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
 * - If the parsed object has a top-level `bytes` field (RETURN_BYTES mode),
 *   the parsed object is returned as `raw` and a default human-friendly message
 *   is provided.
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
      raw: { status: 'PARSE_ERROR', error: error, originalOutput: rawOutput },
      humanMessage: 'Error: Failed to parse tool output. The output was malformed.',
    };
  }

  // Case 1: Handle RETURN_BYTES mode output
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
    raw: { status: 'PARSE_ERROR', originalOutput: rawOutput, parsedObject },
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
      raw: { status: 'PARSE_ERROR', error: error, originalOutput: rawOutput },
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
        status: 'PARSE_ERROR',
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
 * a stable success / failure / parse_error shape.
 *
 * - `success`: the underlying tool reported a non-error status. `data` exposes
 *   the original `raw` payload typed as `T`. `transactionId` is lifted out
 *   when present so consumers don't need to know which sub-field carries it.
 * - `failure`: the tool surfaced an error — either an SDK `Status` object
 *   (`raw.status` is an object with a numeric `_code`, e.g. `Status.InvalidTransaction`)
 *   or an explicit `raw.error` string. `errorCode` is normalised to the
 *   numeric SDK code when available, falling back to the string status.
 * - `parse_error`: the upstream parser could not interpret the tool output
 *   (`raw.status === 'PARSE_ERROR'`) or the envelope was malformed.
 */
export type ToolResultStatus<T = unknown> =
  | { kind: 'success'; transactionId?: string; data: T; humanMessage: string }
  | { kind: 'failure'; errorCode: number | string; error: string; humanMessage: string }
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

  if (raw.status === 'PARSE_ERROR') {
    return {
      kind: 'parse_error',
      originalOutput: 'originalOutput' in raw ? raw.originalOutput : raw,
      humanMessage,
    };
  }

  if (raw.status === 'SUCCESS') {
    return {
      kind: 'success',
      transactionId: typeof raw.transactionId === 'string' ? raw.transactionId : undefined,
      data: raw as T,
      humanMessage,
    };
  }

  if (raw.status === 'ERROR' || typeof raw.error === 'string') {
    return {
      kind: 'failure',
      errorCode: typeof raw.status === 'string' ? raw.status : 'UNKNOWN',
      error: typeof raw.error === 'string' ? raw.error : humanMessage,
      humanMessage,
    };
  }

  return { kind: 'unknown', humanMessage };
};
