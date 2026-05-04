/**
 * Retry configuration options
 */
export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Delay between retries in milliseconds (default: 1000) */
  delayMs?: number;
  /** Whether to log retry attempts (default: true) */
  logRetries?: boolean;
}

/**
 * Default retry options
 */
const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  delayMs: 30000,
  logRetries: true,
};

/**
 * Sleep utility for delays
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
 * Replaces fixed `wait(MIRROR_NODE_WAITING_TIME)` sleeps with adaptive waits:
 * returns as soon as the mirror has the data (often <500ms on Solo) and only
 * burns the full budget on actual lag. Throws on timeout, including the last
 * predicate error if any.
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
 * Polls mirror node until the given transaction is ingested.
 *
 * Drop-in replacement for `await wait(MIRROR_NODE_WAITING_TIME)` whenever the previous
 * SDK call or tool execution returned a transaction ID. Once the tx is in mirror, all
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

/**
 * Wraps a test function with retry logic
 * @param testFn The test function to wrap
 * @param options Retry configuration options
 * @returns A function that can be used as a test case
 */
export function withRetry<T extends any[]>(
  testFn: (...args: T) => Promise<void> | void,
  options: RetryOptions = {},
): (...args: T) => Promise<void> {
  const config = { ...DEFAULT_RETRY_OPTIONS, ...options };

  return async (...args: T): Promise<void> => {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
      try {
        await testFn(...args);
        // If we get here, the test passed
        if (config.logRetries && attempt > 1) {
          console.log(`✅ Test passed on attempt ${attempt}`);
        }
        return;
      } catch (error) {
        lastError = error as Error;

        if (config.logRetries) {
          console.log(
            `❌ Test failed on attempt ${attempt}/${config.maxRetries}: ${lastError.message}`,
          );
        }

        // If this was the last attempt, don't wait
        if (attempt === config.maxRetries) {
          break;
        }

        // Wait before retrying
        if (config.delayMs > 0) {
          await sleep(config.delayMs);
        }
      }
    }

    // If we get here, all retries failed
    throw lastError;
  };
}

/**
 * Creates a retry wrapper specifically for e2e tests with sensible defaults
 * @param testFn The test function to wrap
 * @param options Optional retry configuration
 * @returns A function that can be used as a test case
 */
export function withE2ERetry<T extends any[]>(
  testFn: (...args: T) => Promise<void> | void,
  options: RetryOptions = {},
): (...args: T) => Promise<void> {
  // E2E tests typically need longer delays and fewer retries
  const e2eOptions: RetryOptions = {
    maxRetries: 1,
    delayMs: 1000, // 2 seconds between retries for e2e tests
    logRetries: true,
    ...options,
  };

  return withRetry(testFn, e2eOptions);
}

/**
 * Vitest-compatible retry wrapper that preserves test context
 * This function should be used as a replacement for vitest's it() function
 * @param testFn The test function to wrap
 * @param options Retry configuration options
 * @returns A function that can be used with vitest's it() function
 */
export function itWithRetry(
  testFn: () => Promise<void> | void,
  options: RetryOptions = {},
): () => Promise<void> {
  return withE2ERetry(testFn, options);
}
