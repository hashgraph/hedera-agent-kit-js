/**
 * Adaptive polling utilities used by tests to wait for asynchronous, eventually-consistent
 * state, primarily mirror-node ingestion. Test-level retry on flaky LLM responses is
 * handled by vitest's `retry` config (see `vitest.base.ts`), not here.
 */

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

export type WaitForOptions = {
  /** Total budget before giving up (default 10000ms). */
  timeoutMs?: number;
  /** Interval between polls (default 250ms). */
  intervalMs?: number;
  /** Label used in the timeout error message. */
  description?: string;
};

/**
 * Polls `condition` until it returns a truthy value, or `timeoutMs` elapses.
 *
 * Adaptive wait: returns as soon as the predicate is satisfied (often <500ms on
 * Solo) and only burns the full budget on actual lag. Throws on timeout,
 * including the last predicate error if any.
 */
export async function waitFor<T>(
  condition: () => Promise<T | null | undefined | false> | T | null | undefined | false,
  options: WaitForOptions = {},
): Promise<T> {
  const { timeoutMs = 10000, intervalMs = 250, description = 'condition' } = options;
  const deadline = Date.now() + timeoutMs;
  let lastError: Error | undefined;

  while (Date.now() < deadline) {
    try {
      const value = await condition();
      if (value !== null && value !== undefined && value !== false) {
        return value as T;
      }
    } catch (e) {
      lastError = e as Error;
    }
    await sleep(intervalMs);
  }

  const detail = lastError ? ` (last error: ${lastError.message})` : '';
  throw new Error(`Timed out after ${timeoutMs}ms waiting for ${description}${detail}`);
}

/**
 * Polls mirror node until the given transaction is ingested. Use after any SDK call
 * or tool execution that returns a transaction ID. Once the tx is in mirror, all
 * downstream entity state (balances, tokens, accounts, allowances) is also visible.
 *
 * @param wrapper - HederaOperationsWrapper bound to any client (mirror endpoint comes from its ledger).
 * @param transactionId - SDK or mirror format transaction ID.
 * @param options - Polling budget; defaults: 8000ms timeout, 250ms interval.
 */
export async function waitForMirrorTx(
  wrapper: { getTransactionRecord: (id: string) => Promise<unknown> },
  transactionId: string,
  options: WaitForOptions = {},
): Promise<void> {
  await waitFor(
    async () => {
      try {
        await wrapper.getTransactionRecord(transactionId);
        return true;
      } catch {
        return null;
      }
    },
    {
      timeoutMs: 8000,
      intervalMs: 250,
      description: `transaction ${transactionId} to appear in mirror node`,
      ...options,
    },
  );
}
