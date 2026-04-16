import { describe, expect, it } from 'vitest';
import { approveNftAllowanceParameters } from '@/shared/parameter-schemas/token.zod';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { Client } from '@hiero-ledger/sdk';

const schema = approveNftAllowanceParameters();

describe('approveNftAllowanceParameters schema (allSerials feature)', () => {
  it('passes when allSerials=true and serialNumbers omitted', () => {
    const input = {
      spenderAccountId: '0.0.2002',
      tokenId: '0.0.7777',
      allSerials: true,
      transactionMemo: 'ok',
    };
    const res = schema.safeParse(input);
    expect(res.success).toBe(true);
  });

  it('schema accepts allSerials=true with serialNumbers (validation moved to normaliser)', () => {
    const input = {
      spenderAccountId: '0.0.2002',
      tokenId: '0.0.7777',
      allSerials: true,
      serialNumbers: [1, 2],
    } as any;
    // Schema no longer validates allSerials/serialNumbers mutual exclusivity
    // That validation is now in the normaliser
    const res = schema.safeParse(input);
    expect(res.success).toBe(true);
  });

  it('normaliser throws when allSerials=true and serialNumbers provided', () => {
    const input = {
      spenderAccountId: '0.0.2002',
      tokenId: '0.0.7777',
      allSerials: true,
      serialNumbers: [1, 2],
    };
    const mockClient = {} as Client;
    const context = { accountId: '0.0.1001' };
    expect(() =>
      HederaParameterNormaliser.normaliseApproveNftAllowance(input, context, mockClient),
    ).toThrow(/allSerials=true/i);
  });

  it('normaliser throws when allSerials is false/omitted and serialNumbers is empty or omitted', () => {
    const cases = [
      { spenderAccountId: '0.0.2002', tokenId: '0.0.7777', serialNumbers: [] },
      { spenderAccountId: '0.0.2002', tokenId: '0.0.7777' },
      { spenderAccountId: '0.0.2002', tokenId: '0.0.7777', allSerials: false },
    ];
    const mockClient = {} as Client;
    const context = { accountId: '0.0.1001' };

    for (const input of cases) {
      expect(() =>
        HederaParameterNormaliser.normaliseApproveNftAllowance(input as any, context, mockClient),
      ).toThrow(/serialNumbers must contain at least one serial/i);
    }
  });

  it('passes when allSerials is not true and serialNumbers contain at least one', () => {
    const input = {
      spenderAccountId: '0.0.2002',
      tokenId: '0.0.7777',
      serialNumbers: [5],
    };
    const res = schema.safeParse(input);
    expect(res.success).toBe(true);
  });
});
