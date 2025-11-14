export const transactionToolOutputParser = (rawOutput: string): { raw: any; humanMessage: string } => {
  let parsedObject;
  try {
    parsedObject = JSON.parse(rawOutput);
  } catch (error) {
    console.error(`[transactionToolOutputParser] Failed to parse JSON:`, rawOutput, error);
    return {
      raw: { status: 'PARSE_ERROR', error: error, originalOutput: rawOutput },
      humanMessage: 'Error: Failed to parse tool output. The output was malformed.'
    };
  }

  // Case 1: Handle RETURN_BYTES mode output
  if (parsedObject && parsedObject.bytes) {
    return {
      raw: parsedObject, // The 'raw' data *is* the object with the bytes
      humanMessage: 'Transaction bytes are ready for signing.' // The parser can add a helpful default message
    };
  }

  // Case 2: Handle EXECUTE_TRANSACTION mode output
  if (parsedObject && parsedObject.raw) {
    return {
      raw: parsedObject.raw,
      humanMessage: parsedObject.humanMessage || 'Transaction processed, but no summary was provided.'
    };
  }

  // Fallback for anything else
  console.error(`[transactionToolOutputParser] Parsed object has unknown shape:`, parsedObject);
  return {
    raw: { status: 'PARSE_ERROR', originalOutput: rawOutput, parsedObject },
    humanMessage: 'Error: Parsed tool output had an unexpected format.'
  };
};