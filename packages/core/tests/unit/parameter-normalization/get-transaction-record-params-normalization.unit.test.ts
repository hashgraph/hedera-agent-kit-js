import { describe, it, expect } from 'vitest';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';

describe('HederaParameterNormaliser.normaliseGetTransactionRecordParams', () => {
  const context: any = {}; // context not used in normalization

  it('returns mirror-node style transactionId as-is', () => {
    const params = {
      transactionId: '0.0.90-1756968265-343000618',
      nonce: 5,
    };

    const res = HederaParameterNormaliser.normaliseGetTransactionRecordParams(params, context);

    expect(res.transactionId).toBe('0.0.90-1756968265-343000618');
    expect(res.nonce).toBe(5);
  });

  it('converts SDK-style transactionId to mirror-node style', () => {
    const params = {
      transactionId: '0.0.90@1756968265.343000618',
      nonce: 2,
    };

    const res = HederaParameterNormaliser.normaliseGetTransactionRecordParams(params, context);

    expect(res.transactionId).toBe('0.0.90-1756968265-343000618');
    expect(res.nonce).toBe(2);
  });

  it('converts SDK-style transactionId to mirror-node style - with last part beginning with 0', () => {
    const params = {
      transactionId: '0.0.90@1756968265.043000618',
      nonce: 2,
    };

    const res = HederaParameterNormaliser.normaliseGetTransactionRecordParams(params, context);

    expect(res.transactionId).toBe('0.0.90-1756968265-043000618');
    expect(res.nonce).toBe(2);
  });

  it('throws an error if transactionId is missing', () => {
    const params = {
      nonce: 0,
    } as any;

    expect(() =>
      HederaParameterNormaliser.normaliseGetTransactionRecordParams(params, context),
    ).toThrow('Invalid parameters: Field "transactionId" - Required');
  });

  it('throws an error if transactionId format is invalid', () => {
    const params = {
      transactionId: 'invalid-format',
      nonce: 1,
    };

    expect(() =>
      HederaParameterNormaliser.normaliseGetTransactionRecordParams(params, context),
    ).toThrow('Invalid transactionId format: invalid-format');
  });

  it('passes through nonce even if transactionId is valid', () => {
    const params = {
      transactionId: '0.0.1-123456-7890',
      nonce: 42,
    };

    const res = HederaParameterNormaliser.normaliseGetTransactionRecordParams(params, context);

    expect(res.nonce).toBe(42);
  });
});
