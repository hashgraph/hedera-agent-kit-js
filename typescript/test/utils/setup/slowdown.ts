import { beforeEach } from 'vitest';

const DEFAULT_DELAY_MS = 500;

function getDelayMs(): number {
  const raw = process.env.SLOW_TEST_DELAY_MS;
  if (!raw) return DEFAULT_DELAY_MS;
  const n = Number(raw);
  if (Number.isFinite(n) && n >= 0) return n;
  return DEFAULT_DELAY_MS;
}

const delayMs = getDelayMs();

// If the delay is zero, don't register a hook to avoid overhead.
if (delayMs > 0) {
  let updatedDelayMs = delayMs * 2;
  console.log(`Slowing down tests by ${updatedDelayMs}ms`);
  beforeEach(async ctx => {
    const currentFilepath = ctx?.task?.file?.filepath ?? '';
    // Skip slowdown for Hedera integration tests
    if (currentFilepath.includes('/integration/hedera/')) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, updatedDelayMs));
  });
}
