import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AccountId } from '@hashgraph/sdk';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';

vi.mock('@/shared/utils/account-resolver', () => ({
  AccountResolver: {
    resolveAccount: vi.fn((_maybeId: string | undefined, _context: any, _client: any) => '0.0.1001'),
  },
}));
import { AccountResolver } from '@/shared/utils/account-resolver';

describe('HederaParameterNormaliser.normaliseUpdateAccount', () => {
  const context: any = { accountId: '0.0.5005' };
  const client: any = { operatorAccountId: AccountId.fromString('0.0.5005') };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves accountId via AccountResolver when not provided and includes provided fields only', () => {
    const params = {
      accountMemo: 'hello',
      maxAutomaticTokenAssociations: 7,
      declineStakingReward: false,
    } as any;

    const res = HederaParameterNormaliser.normaliseUpdateAccount(params, context, client) as any;

    expect(AccountResolver.resolveAccount).toHaveBeenCalledWith(undefined, context, client);
    expect(res.accountId).toBeInstanceOf(AccountId);
    expect(res.accountMemo).toBe('hello');
    expect(res.maxAutomaticTokenAssociations).toBe(7);
    expect(res.declineStakingReward).toBe(false);
    expect('stakedAccountId' in res).toBe(false);
  });

  it('passes through stakedAccountId when provided', () => {
    const params = {
      accountId: '0.0.7777',
      stakedAccountId: '0.0.9999',
    } as any;

    (AccountResolver.resolveAccount as any).mockReturnValueOnce('0.0.7777');

    const res = HederaParameterNormaliser.normaliseUpdateAccount(params, context, client) as any;

    expect(AccountResolver.resolveAccount).toHaveBeenCalledWith('0.0.7777', context, client);
    expect(res.accountId.toString()).toBe('0.0.7777');
    expect(res.stakedAccountId).toBe('0.0.9999');
  });

  it('omits optional fields that are not provided', () => {
    const params = { accountId: '0.0.1' } as any;
    (AccountResolver.resolveAccount as any).mockReturnValueOnce('0.0.1');

    const res = HederaParameterNormaliser.normaliseUpdateAccount(params, context, client) as any;

    expect(Object.prototype.hasOwnProperty.call(res, 'accountMemo')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(res, 'maxAutomaticTokenAssociations')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(res, 'declineStakingReward')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(res, 'stakedAccountId')).toBe(false);
  });
});
