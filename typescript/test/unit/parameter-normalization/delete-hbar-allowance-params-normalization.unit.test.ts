import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Client, AccountId, Hbar } from '@hashgraph/sdk';
import { Context } from '@/shared/configuration';
import { AccountResolver } from '@/shared/utils/account-resolver';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';

// Mock the AccountResolver
vi.mock('@/shared/utils/account-resolver', () => ({
  AccountResolver: { resolveAccount: vi.fn() },
}));

describe('HederaParameterNormaliser.normaliseDeleteHbarAllowance', () => {
  let mockContext: Context;
  let mockClient: Client;
  const operatorId = AccountId.fromString('0.0.5005').toString();

  beforeEach(() => {
    vi.clearAllMocks();
    mockContext = {};
    mockClient = {} as Client;
    vi.mocked(AccountResolver.resolveAccount).mockReturnValue(operatorId);
  });

  it('normalizes params with explicit owner, spender and optional memo', () => {
    const params = {
      ownerAccountId: '0.0.1111',
      spenderAccountId: '0.0.2222',
      transactionMemo: 'delete memo',
    };

    const res = HederaParameterNormaliser.normaliseDeleteHbarAllowance(
      params as any,
      mockContext,
      mockClient,
    );

    expect(AccountResolver.resolveAccount).toHaveBeenCalledWith(
      '0.0.1111',
      mockContext,
      mockClient,
    );

    expect(res.hbarApprovals?.at(0)?.ownerAccountId?.toString()).toBe(operatorId);
    expect(res.hbarApprovals?.at(0)?.spenderAccountId?.toString()).toBe('0.0.2222');
    expect(res.transactionMemo).toBe('delete memo');
    expect(res.hbarApprovals?.at(0)?.amount).toBeInstanceOf(Hbar);
    expect((res.hbarApprovals?.at(0)?.amount as Hbar).toTinybars().toString()).toBe('0');
  });

  it('defaults ownerAccountId using AccountResolver when not provided', () => {
    const params = {
      spenderAccountId: '0.0.3333',
    };

    const res = HederaParameterNormaliser.normaliseDeleteHbarAllowance(
      params as any,
      mockContext,
      mockClient,
    );

    expect(AccountResolver.resolveAccount).toHaveBeenCalledWith(undefined, mockContext, mockClient);

    expect(res.hbarApprovals?.at(0)?.ownerAccountId?.toString()).toBe(operatorId);
    expect(res.hbarApprovals?.at(0)?.spenderAccountId?.toString()).toBe('0.0.3333');
    expect((res.hbarApprovals?.at(0)?.amount as Hbar).toTinybars().toString()).toBe('0');
  });

  it('always sets allowance amount to 0 regardless of input', () => {
    const params = {
      ownerAccountId: '0.0.4444',
      spenderAccountId: '0.0.5555',
      // malicious/accidental amount field should be ignored
      amount: 9999,
    };

    const res = HederaParameterNormaliser.normaliseDeleteHbarAllowance(
      params as any,
      mockContext,
      mockClient,
    );

    expect((res.hbarApprovals?.at(0)?.amount as Hbar).toTinybars().toString()).toBe('0');
  });
});
