import { describe, it, expect } from 'vitest';
import type { Client } from '@hiero-ledger/sdk';
import { assertEcdsaOperator } from '@/plugins/core-evm-plugin/utils/operator-key';

const clientWithOperatorKeyType = (type: string | undefined): Client =>
  ({
    operatorPublicKey: type === undefined ? null : ({ type } as any),
  } as unknown as Client);

describe('assertEcdsaOperator', () => {
  it('should not throw when the operator key is ECDSA (secp256k1)', () => {
    const client = clientWithOperatorKeyType('secp256k1');
    expect(() => assertEcdsaOperator(client)).not.toThrow();
  });

  it('should throw when the operator key is ED25519', () => {
    const client = clientWithOperatorKeyType('ED25519');
    expect(() => assertEcdsaOperator(client)).toThrow(
      /EVM tools require an ECDSA \(secp256k1\) operator key.*"ED25519".*INVALID_SIGNATURE/,
    );
  });

  it('should throw when no operator key is configured on the client', () => {
    const client = clientWithOperatorKeyType(undefined);
    expect(() => assertEcdsaOperator(client)).toThrow(
      /EVM tools require a client with an operator key set/,
    );
  });
});
