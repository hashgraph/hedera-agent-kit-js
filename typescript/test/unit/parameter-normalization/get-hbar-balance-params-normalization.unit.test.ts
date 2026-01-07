import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Client } from '@hashgraph/sdk';
import { Context } from '@/shared/configuration';
import { AccountResolver } from '@/shared/utils/account-resolver';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { accountBalanceQueryParameters } from '@/shared/parameter-schemas/account.zod';

vi.mock('@/shared/utils/account-resolver', () => ({
  AccountResolver: { resolveAccount: vi.fn() },
}));

describe('HbarBalanceParamsNormalizer.normaliseHbarBalanceParams', () => {
  let mockContext: Context;
  let mockClient: Client;

  beforeEach(() => {
    vi.clearAllMocks();
    mockContext = {};
    mockClient = {} as Client;
    vi.mocked(AccountResolver.resolveAccount).mockReturnValue('0.0.1001');
  });

  it('normalizes accountId using AccountResolver when provided', () => {
    const params: any = { accountId: '0.0.0' } as unknown as ReturnType<
      typeof accountBalanceQueryParameters
    >;

    const res = HederaParameterNormaliser.normaliseHbarBalanceParams(
      params as any,
      mockContext,
      mockClient,
    );

    expect(res.accountId).toBe('0.0.1001');
    expect(AccountResolver.resolveAccount).toHaveBeenCalledWith('0.0.0', mockContext, mockClient);
  });

  it('defaults to resolved accountId when not provided', () => {
    const params: any = {};
    const res = HederaParameterNormaliser.normaliseHbarBalanceParams(
      params,
      mockContext,
      mockClient,
    );
    expect(res.accountId).toBe('0.0.1001');
  });
});
