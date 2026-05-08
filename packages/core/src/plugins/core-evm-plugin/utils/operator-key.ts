import { Client } from '@hiero-ledger/sdk';

const ECDSA_KEY_TYPE = 'secp256k1';

export function assertEcdsaOperator(client: Client): void {
  const operatorKey = client.operatorPublicKey;
  if (!operatorKey) {
    throw new Error(
      'EVM tools require a client with an operator key set. None is configured on the provided client.',
    );
  }
  if (operatorKey.type !== ECDSA_KEY_TYPE) {
    throw new Error(
      `EVM tools require an ECDSA (secp256k1) operator key. The configured operator key is "${operatorKey.type}", which the network will reject with INVALID_SIGNATURE on contract execution. Use an ECDSA key (recommended: raw hex 0x + 64 chars).`,
    );
  }
}
