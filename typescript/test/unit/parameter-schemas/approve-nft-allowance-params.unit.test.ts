import { describe, expect, it } from 'vitest';
import { approveNftAllowanceParameters } from '@/shared/parameter-schemas/token.zod';

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

  it('fails when allSerials=true and serialNumbers provided', () => {
    const input = {
      spenderAccountId: '0.0.2002',
      tokenId: '0.0.7777',
      allSerials: true,
      serialNumbers: [1, 2],
    } as any;
    const res = schema.safeParse(input);
    expect(res.success).toBe(false);
    if (!res.success) {
      const msg = JSON.stringify(res.error.format());
      expect(msg).toMatch(/allSerials=true/i);
      expect(msg).toMatch(/serialNumbers/i);
    }
  });

  it('fails when allSerials is omitted/false and serialNumbers is empty or omitted', () => {
    const cases = [
      { spenderAccountId: '0.0.2002', tokenId: '0.0.7777', serialNumbers: [] },
      { spenderAccountId: '0.0.2002', tokenId: '0.0.7777' },
      { spenderAccountId: '0.0.2002', tokenId: '0.0.7777', allSerials: false },
    ];

    for (const input of cases) {
      const res = schema.safeParse(input as any);
      expect(res.success).toBe(false);
      if (!res.success) {
        const msg = JSON.stringify(res.error.format());
        expect(msg).toMatch(/serialNumbers must contain at least one serial/i);
      }
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
