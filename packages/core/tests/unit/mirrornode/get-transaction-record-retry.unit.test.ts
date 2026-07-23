import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LedgerId } from '@hiero-ledger/sdk';
import { HederaMirrornodeServiceDefaultImpl } from '@/shared/hedera-utils/mirrornode/hedera-mirrornode-service-default-impl';

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
const notFound = () => ({ ok: false, status: 404, statusText: 'Not Found' });
const serverError = () => ({ ok: false, status: 500, statusText: 'Internal Server Error' });

describe('mirror node getTransactionRecord - 404 retry with backoff', () => {
  const service = new HederaMirrornodeServiceDefaultImpl(LedgerId.TESTNET);

  beforeEach(() => {
    vi.useFakeTimers();
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('retries a fresh-transaction 404 and resolves once indexed', async () => {
    const record = { transactions: [{ result: 'SUCCESS' }] };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(notFound()) // not indexed yet
      .mockResolvedValueOnce(notFound()) // still not indexed
      .mockResolvedValueOnce(ok(record)); // indexed
    vi.stubGlobal('fetch', fetchMock);

    const promise = service.getTransactionRecord('0.0.1-1-1');
    await vi.runAllTimersAsync(); // fast-forward the backoff waits

    await expect(promise).resolves.toEqual(record);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('throws after exhausting retries when it stays 404', async () => {
    const fetchMock = vi.fn().mockResolvedValue(notFound());
    vi.stubGlobal('fetch', fetchMock);

    const promise = service.getTransactionRecord('0.0.9-9-9');
    const assertion = expect(promise).rejects.toThrow('404 Not Found');
    await vi.runAllTimersAsync();
    await assertion;

    expect(fetchMock).toHaveBeenCalledTimes(3); // maxAttempts
  });

  it('does not retry non-404 errors', async () => {
    const fetchMock = vi.fn().mockResolvedValue(serverError());
    vi.stubGlobal('fetch', fetchMock);

    await expect(service.getTransactionRecord('0.0.2-2-2')).rejects.toThrow('500');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('applies the same 404 retry to other methods (getTokenInfo)', async () => {
    const info = { token_id: '0.0.5', symbol: 'FOO' };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(notFound()) // token not indexed yet after creation
      .mockResolvedValueOnce(ok(info));
    vi.stubGlobal('fetch', fetchMock);

    const promise = service.getTokenInfo('0.0.5');
    await vi.runAllTimersAsync();

    await expect(promise).resolves.toEqual(info);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
