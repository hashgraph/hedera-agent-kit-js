import { describe, it, expect } from 'vitest';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { Client, AccountId, PrivateKey } from '@hashgraph/sdk';

const makeClient = () => {
  const client = Client.forNetwork({});
  // set a fake operator so AccountResolver can fall back to client when needed
  client.setOperator(AccountId.fromString('0.0.5005'), PrivateKey.generateED25519());
  return client;
};

describe('HederaParameterNormaliser.normaliseAccountTokenBalancesParams', () => {
  const client = makeClient();

  it('resolves accountId from params when provided and passes tokenId through', () => {
    const context: any = { accountId: '0.0.1001' };

    const res = HederaParameterNormaliser.normaliseAccountTokenBalancesParams(
      { accountId: '0.0.2222', tokenId: '0.0.3333' } as any,
      context,
      client,
    );

    expect(res.accountId).toBe('0.0.2222');
    expect(res.tokenId).toBe('0.0.3333');
  });

  it('falls back to operator accountId when params.accountId is omitted', () => {
    const context: any = { accountId: client.operatorAccountId?.toString() };

    const res = HederaParameterNormaliser.normaliseAccountTokenBalancesParams(
      { tokenId: '0.0.7777' } as any,
      context,
      client,
    );

    expect(res.accountId).toBe(client.operatorAccountId?.toString());
    expect(res.tokenId).toBe('0.0.7777');
  });
});
