import { describe, it, expect, vi, beforeEach } from 'vitest';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import type { Context } from '@/shared/configuration';
import { AccountId, Client, PrivateKey, PublicKey } from '@hashgraph/sdk';

describe('HederaParameterNormaliser.normaliseAssociateTokenParams', () => {
  const context = { accountId: '0.0.1111' } as Context;
  const client = Client.forNetwork({}).setOperator(AccountId.fromString('0.0.1111'), PrivateKey.generateED25519());

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should use provided accountId and pass tokenIds through', () => {
    const params: any = {
      accountId: '0.0.2222',
      tokenIds: ['0.0.1234', '0.0.5678'],
    };

    const result = HederaParameterNormaliser.normaliseAssociateTokenParams(
      params,
      context,
      client,
    );

    expect(result).toEqual({ accountId: '0.0.2222', tokenIds: ['0.0.1234', '0.0.5678'] });
  });

  it('should fall back to context/operator account when accountId not provided', () => {
    const params: any = {
      tokenIds: ['0.0.9999'],
    };

    const result = HederaParameterNormaliser.normaliseAssociateTokenParams(
      params,
      context,
      client,
    );

    expect(result.accountId).toBe('0.0.1111');
    expect(result.tokenIds).toEqual(['0.0.9999']);
  });
});


