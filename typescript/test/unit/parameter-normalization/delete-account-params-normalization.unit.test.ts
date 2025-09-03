import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AccountId, Client } from '@hashgraph/sdk';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';

vi.mock('@/shared/utils/account-resolver', () => ({
  AccountResolver: {
    isHederaAddress: vi.fn((addr: string) => /^\d+\.\d+\.\d+$/.test(addr)),
    getDefaultAccount: vi.fn((_context?: any, _client?: any) => '0.0.1001'),
  },
}));
import { AccountResolver } from '@/shared/utils/account-resolver';

const makeClient = () => Client.forNetwork({});

describe('HederaParameterNormaliser.normaliseDeleteAccount', () => {
  const context: any = { accountId: '0.0.5005' };
  let client: Client;

  beforeEach(() => {
    vi.clearAllMocks();
    client = makeClient();
  });

  it('uses provided accountId and transferAccountId when both are valid Hedera addresses', () => {
    const params = { accountId: '0.0.1234', transferAccountId: '0.0.4321' } as any;

    const res = HederaParameterNormaliser.normaliseDeleteAccount(params, context, client);

    expect(AccountResolver.isHederaAddress).toHaveBeenCalledWith('0.0.1234');
    expect(res.accountId).toBeInstanceOf(AccountId);
    expect(res.transferAccountId).toBeInstanceOf(AccountId);
    expect(res.accountId.toString()).toBe('0.0.1234');
    expect(res.transferAccountId.toString()).toBe('0.0.4321');
  });

  it('defaults transferAccountId using AccountResolver.getDefaultAccount when not provided', () => {
    (AccountResolver.getDefaultAccount as any).mockReturnValueOnce('0.0.7777');
    const params = { accountId: '0.0.999' } as any;

    const res = HederaParameterNormaliser.normaliseDeleteAccount(params, context, client);

    expect(AccountResolver.getDefaultAccount).toHaveBeenCalledWith(context, client);
    expect(res.transferAccountId.toString()).toBe('0.0.7777');
    expect(res.accountId.toString()).toBe('0.0.999');
  });

  it('throws when accountId is not a Hedera address', () => {
    const params = { accountId: 'not-hedera', transferAccountId: '0.0.1' } as any;

    (AccountResolver.isHederaAddress as any).mockReturnValueOnce(false);

    expect(() => HederaParameterNormaliser.normaliseDeleteAccount(params, context, client)).toThrow(
      'Account ID must be a Hedera address',
    );
  });

  it('converts string ids to AccountId instances', () => {
    const params = { accountId: '0.0.12', transferAccountId: '0.0.34' } as any;

    const res = HederaParameterNormaliser.normaliseDeleteAccount(params, context, client);

    expect(res.accountId).toBeInstanceOf(AccountId);
    expect(res.transferAccountId).toBeInstanceOf(AccountId);
  });
});
