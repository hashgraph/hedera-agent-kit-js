import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LedgerId } from '@hiero-ledger/sdk';
import { HederaMirrornodeServiceDefaultImpl } from '@/shared/hedera-utils/mirrornode/hedera-mirrornode-service-default-impl';

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
const notFound = () => ({ ok: false, status: 404, statusText: 'Not Found' });

const DECIMALS_18 = {
  result: '0x0000000000000000000000000000000000000000000000000000000000000012',
};

describe('mirror node getERC20Decimals', () => {
  const service = new HederaMirrornodeServiceDefaultImpl(LedgerId.TESTNET);

  beforeEach(() => {
    vi.useFakeTimers();
    vi.restoreAllMocks();
    vi.spyOn(service, 'getContractInfo').mockResolvedValue({ evm_address: '0xabc' } as any);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reads decimals via the mirror node contracts/call endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok(DECIMALS_18));
    vi.stubGlobal('fetch', fetchMock);

    await expect(service.getERC20Decimals('0.0.5678')).resolves.toBe(18);
    expect(fetchMock).toHaveBeenCalledWith(
      `${service.getBaseUrl()}/contracts/call`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ data: '0x313ce567', to: '0xabc' }),
      }),
    );
  });

  it('retries a 404 (contract not indexed yet) and resolves once indexed', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(notFound())
      .mockResolvedValueOnce(ok(DECIMALS_18));
    vi.stubGlobal('fetch', fetchMock);

    const promise = service.getERC20Decimals('0.0.5678');
    await vi.runAllTimersAsync();

    await expect(promise).resolves.toBe(18);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws when the contract call fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 400, statusText: 'Bad Request' }),
    );

    await expect(service.getERC20Decimals('0.0.5678')).rejects.toThrow(
      'Failed to read decimals of ERC20 contract 0.0.5678: 400 Bad Request',
    );
  });
});
