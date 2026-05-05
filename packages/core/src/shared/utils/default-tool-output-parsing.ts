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
