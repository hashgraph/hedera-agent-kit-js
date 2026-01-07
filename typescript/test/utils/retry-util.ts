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
