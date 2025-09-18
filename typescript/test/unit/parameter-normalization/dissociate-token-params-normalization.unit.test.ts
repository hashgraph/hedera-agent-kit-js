import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Client, AccountId, TokenId } from '@hashgraph/sdk';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import type { Context } from '@/shared/configuration';
import { AccountResolver } from '@/shared/utils/account-resolver';

vi.mock('@/shared/utils/account-resolver', () => ({
  AccountResolver: {
    getDefaultAccount: vi.fn(),
  },
}));

describe('HederaParameterNormaliser.normaliseDissociateTokenParams', () => {
  let client: Client;
  let context: Context;

  beforeEach(() => {
    client = {} as Client;
    context = { accountId: '0.0.1234' };
    vi.clearAllMocks();
  });

  it('should convert tokenIds strings to TokenId instances', async () => {
    const params = { tokenIds: ['0.0.1001', '0.0.1002'], accountId: '0.0.5678' };

    const result = await HederaParameterNormaliser.normaliseDissociateTokenParams(
      params,
      context,
      client,
    );

    expect(result.tokenIds).toHaveLength(2);
    expect(result.tokenIds[0]).toBeInstanceOf(TokenId);
    expect(result.tokenIds[1]).toBeInstanceOf(TokenId);
    expect(result.tokenIds[0].toString()).toBe('0.0.1001');
    expect(result.accountId).toBeInstanceOf(AccountId);
    expect(result.accountId.toString()).toBe('0.0.5678');
  });

  it('should use default account if accountId is not provided', async () => {
    const params = { tokenIds: ['0.0.2001'] };
    (AccountResolver.getDefaultAccount as any).mockReturnValue('0.0.9999');

    const result = await HederaParameterNormaliser.normaliseDissociateTokenParams(
      params,
      context,
      client,
    );

    expect(AccountResolver.getDefaultAccount).toHaveBeenCalledWith(context, client);
    expect(result.accountId.toString()).toBe('0.0.9999');
    expect(result.tokenIds[0].toString()).toBe('0.0.2001');
  });

  it('should throw if no accountId and default account not found', async () => {
    const params = { tokenIds: ['0.0.3001'] };
    (AccountResolver.getDefaultAccount as any).mockReturnValue(undefined);

    await expect(
      HederaParameterNormaliser.normaliseDissociateTokenParams(params, context, client),
    ).rejects.toThrow('Could not determine default account ID');
  });

  it('should throw if tokenIds array is empty', async () => {
    const params = { tokenIds: [] };
    await expect(
      HederaParameterNormaliser.normaliseDissociateTokenParams(params, context, client),
    ).rejects.toThrow(); // Zod validation
  });

  it('should handle multiple tokenIds', async () => {
    const params = { tokenIds: ['0.0.4001', '0.0.4002', '0.0.4003'], accountId: '0.0.1234' };

    const result = await HederaParameterNormaliser.normaliseDissociateTokenParams(
      params,
      context,
      client,
    );

    expect(result.tokenIds).toHaveLength(3);
    expect(result.tokenIds.every(t => t instanceof TokenId)).toBe(true);
    expect(result.tokenIds.map(t => t.toString())).toEqual(['0.0.4001', '0.0.4002', '0.0.4003']);
  });

  it('should preserve optional transactionMemo', async () => {
    const params = { tokenIds: ['0.0.5001'], accountId: '0.0.1234', transactionMemo: 'test memo' };

    const result = await HederaParameterNormaliser.normaliseDissociateTokenParams(
      params,
      context,
      client,
    );

    expect(result.transactionMemo).toBe('test memo');
    expect(result.accountId.toString()).toBe('0.0.1234');
  });
});
