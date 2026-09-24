import {
  classifyToolResult,
  isPolicyBlockedToolResult,
  type ToolResultStatus,
} from '@hashgraph/hedera-agent-kit';

/**
 * Extracts the `{ raw, humanMessage }` envelope from an AI SDK tool result.
 *
 * The Vercel AI SDK preserves the structured object returned by `execute` in
 * `toolResult.output`. For Hedera tools the result is already a parsed
 * `{ raw, humanMessage }` envelope (the JSON round-trip and byte hydration are
 * handled inside the tool wrapper). This helper normalises the three common shapes:
 * - `toolResult.output` — standard SDK shape
 * - bare `{ raw, humanMessage }` — direct `execute()` result in tests / AUTONOMOUS mode
 * - a pre-parsed plain object — passed through unchanged
 */
function extractEnvelope(toolResult: any): { raw: any; humanMessage: string } | null {
  if (toolResult == null) return null;

  // Standard AI SDK shape: { output: { raw, humanMessage } }
  if (toolResult.output != null && typeof toolResult.output.humanMessage === 'string') {
    return toolResult.output;
  }

  // Direct result shape: { raw, humanMessage }
  if (toolResult.raw !== undefined && typeof toolResult.humanMessage === 'string') {
    return toolResult;
  }

  return null;
}

/**
 * Policy-aware result parser for the Vercel AI SDK integration.
 *
 * Wraps {@link classifyToolResult} with AI-SDK-specific envelope extraction.
 * Use this when your server calls Hedera tools via `generateText` / `streamText`
 * and needs to branch on policy blocks rather than parse prose error messages.
 *
 * @example
 * ```ts
 * const parser = new PolicyResultParser();
 *
 * // Inside a generateText loop:
 * const blocks = parser.parsePolicyBlocks(result.toolResults);
 * for (const block of blocks) {
 *   if (block.kind === 'policy_block') {
 *     switch (block.policyName) {
 *       case 'Grant Amount Policy':
 *         await queueForAdminReview({ details: block.details });
 *         break;
 *       case 'Grant Review Policy':
 *         throw new Error('Review metadata failed policy');
 *     }
 *   }
 * }
 * ```
 */
export class PolicyResultParser {
  /**
   * Classify a single AI SDK tool result into a `ToolResultStatus` discriminated union.
   *
   * @param toolResult - The value returned by a Hedera AI SDK tool's `execute`, or a
   *   step entry from `result.toolResults` / `result.steps[n].toolResults`.
   * @returns A `ToolResultStatus` (`success | failure | policy_block | parse_error | unknown`).
   */
  parse(toolResult: any): ToolResultStatus {
    const envelope = extractEnvelope(toolResult);
    if (envelope == null) {
      return { kind: 'parse_error', originalOutput: toolResult, humanMessage: 'Unable to extract { raw, humanMessage } envelope from tool result.' };
    }
    return classifyToolResult(envelope);
  }

  /**
   * Quick boolean check — returns `true` if the given tool result was blocked by a policy.
   *
   * Prefer {@link parsePolicyBlocks} when you need the structured fields.
   */
  isPolicyBlocked(toolResult: any): boolean {
    const envelope = extractEnvelope(toolResult);
    return envelope != null && isPolicyBlockedToolResult(envelope);
  }

  /**
   * Filter an array of tool results to those that were blocked by a policy.
   *
   * Pass `result.toolResults` or `step.toolResults` from a `generateText` /
   * `streamText` call. Returns only the `kind: 'policy_block'` entries with
   * full typed fields (`policyName`, `stage`, `details`, etc.).
   *
   * @param toolResults - Any iterable of AI SDK tool result objects.
   */
  parsePolicyBlocks(toolResults: any[]): Extract<ToolResultStatus, { kind: 'policy_block' }>[] {
    return toolResults
      .map((r) => this.parse(r))
      .filter((r): r is Extract<ToolResultStatus, { kind: 'policy_block' }> => r.kind === 'policy_block');
  }
}
