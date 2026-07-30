import {
  classifyToolResult,
  isPolicyBlockedToolResult,
  type ToolResultStatus,
} from '@hashgraph/hedera-agent-kit';

/**
 * Extracts the `{ raw, humanMessage }` envelope from an ADK tool result.
 *
 * ADK's `FunctionTool.execute` returns the object directly (a JSON round-trip
 * is already done inside the wrapper, and bytes are re-hydrated to `Uint8Array`).
 * This helper handles the three common call shapes:
 * - Direct `execute()` return: `{ raw, humanMessage }`
 * - Nested inside an ADK response container: `{ result: { raw, humanMessage } }` (rare)
 * - Already unwrapped envelope: passed through unchanged
 */
function extractEnvelope(adkResult: any): { raw: any; humanMessage: string } | null {
  if (adkResult == null) return null;

  // Direct shape returned by HederaAgentKitTool.execute: { raw, humanMessage }
  if (adkResult.raw !== undefined && typeof adkResult.humanMessage === 'string') {
    return adkResult;
  }

  // Possible nested shape: { result: { raw, humanMessage } }
  if (adkResult.result?.raw !== undefined && typeof adkResult.result?.humanMessage === 'string') {
    return adkResult.result;
  }

  return null;
}

/**
 * Policy-aware result parser for the Google ADK integration.
 *
 * Wraps {@link classifyToolResult} with ADK-specific envelope extraction.
 * ADK tools return a structured object from `execute` (not a string), so the
 * envelope is available immediately without a separate parse step.
 *
 * @example
 * ```ts
 * const parser = new PolicyResultParser();
 *
 * // After calling a tool directly:
 * const result = await myAdkTool.execute(args);
 * const classified = parser.parse(result);
 * if (classified.kind === 'policy_block') {
 *   console.log('Blocked by', classified.policyName, classified.details);
 * }
 *
 * // Or batch-filter from an ADK runner's event stream:
 * const blocks = parser.parsePolicyBlocks(toolCallResults);
 * ```
 */
export class PolicyResultParser {
  /**
   * Classify a single ADK tool result into a `ToolResultStatus` discriminated union.
   *
   * @param adkResult - The value returned by a Hedera ADK tool's `execute`.
   * @returns A `ToolResultStatus` (`success | failure | policy_block | parse_error | unknown`).
   */
  parse(adkResult: any): ToolResultStatus {
    const envelope = extractEnvelope(adkResult);
    if (envelope == null) {
      return {
        kind: 'parse_error',
        originalOutput: adkResult,
        humanMessage: 'Unable to extract { raw, humanMessage } envelope from ADK tool result.',
      };
    }
    return classifyToolResult(envelope);
  }

  /**
   * Quick boolean check — returns `true` if the given ADK tool result was blocked by a policy.
   *
   * Prefer {@link parsePolicyBlocks} when you need the structured fields.
   */
  isPolicyBlocked(adkResult: any): boolean {
    const envelope = extractEnvelope(adkResult);
    return envelope != null && isPolicyBlockedToolResult(envelope);
  }

  /**
   * Filter an array of ADK tool results to those that were blocked by a policy.
   *
   * Returns only the `kind: 'policy_block'` entries with full typed fields
   * (`policyName`, `stage`, `details`, etc.).
   *
   * @param adkResults - An array of values returned by Hedera ADK tool `execute` calls.
   */
  parsePolicyBlocks(adkResults: any[]): Extract<ToolResultStatus, { kind: 'policy_block' }>[] {
    return adkResults
      .map((r) => this.parse(r))
      .filter(
        (r): r is Extract<ToolResultStatus, { kind: 'policy_block' }> =>
          r.kind === 'policy_block',
      );
  }
}
