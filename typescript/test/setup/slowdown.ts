import { beforeAll, beforeEach } from 'vitest';

const DEFAULT_DELAY_MS = 500;

function getDelayMs(): number {
  const raw = process.env.SLOW_TEST_DELAY_MS;
  if (!raw) return DEFAULT_DELAY_MS;
  const n = Number(raw);
  if (Number.isFinite(n) && n >= 0) return n;
  return DEFAULT_DELAY_MS;
}

const delayMs = getDelayMs();

// If delay is zero, don't register hook to avoid overhead.
if (delayMs > 0) {
  console.log(`Slowing down tests by ${delayMs}ms`);
  beforeEach(async () => {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  });
}
