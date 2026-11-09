import {
  AccountId,
  Client,
  Hbar,
  PrivateKey,
  TokenId,
  Transaction,
  TransactionId,
  TransferTransaction,
} from '@hiero-ledger/sdk';
import {
  isHbarAsset,
  assertSupportedHederaNetwork,
  HEDERA_TESTNET_CAIP2,
  createHederaClient,
} from '@x402/hedera';
import type { ClientHederaSigner } from '@x402/hedera';
import type { PaymentRequirements } from '@x402/core/types';

export interface WalletConnectLike {
  signTransaction(params: {
    signerAccountId: string;
    transactionList: string;
  }): Promise<{ transactionList?: string; [key: string]: unknown }>;
}

export interface WalletConnectSignerConfig {
  network?: string;
  nodeUrl?: string;
}

/**
 * ClientHederaSigner adapter that delegates transaction signing to a
 * connected Hedera WalletConnect session (e.g. HashPack, Blade).
 *
 * Implements the `@x402/hedera` ClientHederaSigner interface.
 */
export class WalletConnectClientHederaSigner implements ClientHederaSigner {
  public readonly accountId: string;
  private readonly connector: WalletConnectLike;
  private readonly config: WalletConnectSignerConfig;

  constructor(
    accountId: string,
    connector: WalletConnectLike,
    config: WalletConnectSignerConfig = {},
  ) {
    this.accountId = AccountId.fromString(accountId).toString();
    this.connector = connector;
    this.config = config;
  }

  async createPartiallySignedTransferTransaction(
    requirements: PaymentRequirements,
  ): Promise<string> {
    assertSupportedHederaNetwork(requirements.network);

    const feePayer = requirements.extra?.feePayer;
    if (typeof feePayer !== 'string') {
      throw new Error('feePayer is required in paymentRequirements.extra');
    }

    const amount = BigInt(requirements.amount);
    if (amount <= 0n) {
      throw new Error('amount must be greater than zero');
    }

    const payerId = AccountId.fromString(this.accountId);
    const payToId = AccountId.fromString(requirements.payTo);
    const feePayerId = AccountId.fromString(feePayer);

    const tx = new TransferTransaction();

    if (isHbarAsset(requirements.asset)) {
      tx.addHbarTransfer(payerId, Hbar.fromTinybars((-amount).toString()));
      tx.addHbarTransfer(payToId, Hbar.fromTinybars(amount.toString()));
    } else {
      const tokenId = TokenId.fromString(requirements.asset);
      tx.addTokenTransfer(tokenId, payerId, -amount);
      tx.addTokenTransfer(tokenId, payToId, amount);
    }

    // Use facilitator fee payer account to generate transaction ID
    tx.setTransactionId(TransactionId.generate(feePayerId));

    const network = requirements.network || HEDERA_TESTNET_CAIP2;
    const client = createHederaClient(network, this.config.nodeUrl);

    try {
      tx.freezeWith(client);
      const unsignedBase64 = Buffer.from(tx.toBytes()).toString('base64');

      // HIP-30 account ID (e.g. hedera:testnet:0.0.1234)
      const isMainnet = network.includes('mainnet');
      const hip30 = isMainnet
        ? `hedera:mainnet:${this.accountId}`
        : `hedera:testnet:${this.accountId}`;

      const signResult = await this.connector.signTransaction({
        signerAccountId: hip30,
        transactionList: unsignedBase64,
      });

      const signedBase64 = signResult.transactionList || unsignedBase64;
      return signedBase64;
    } finally {
      client.close();
    }
  }
}

/**
 * Local SDK-backed signer using PrivateKey (useful for headless testing, CI,
 * or background agent scripts).
 */
export class LocalClientHederaSigner implements ClientHederaSigner {
  public readonly accountId: string;
  private readonly privateKey: PrivateKey;
  private readonly config: WalletConnectSignerConfig;

  constructor(
    accountId: string,
    privateKey: PrivateKey | string,
    config: WalletConnectSignerConfig = {},
  ) {
    this.accountId = AccountId.fromString(accountId).toString();
    this.privateKey =
      typeof privateKey === 'string' ? PrivateKey.fromStringECDSA(privateKey) : privateKey;
    this.config = config;
  }

  async createPartiallySignedTransferTransaction(
    requirements: PaymentRequirements,
  ): Promise<string> {
    assertSupportedHederaNetwork(requirements.network);

    const feePayer = requirements.extra?.feePayer;
    if (typeof feePayer !== 'string') {
      throw new Error('feePayer is required in paymentRequirements.extra');
    }

    const amount = BigInt(requirements.amount);
    if (amount <= 0n) {
      throw new Error('amount must be greater than zero');
    }

    const payerId = AccountId.fromString(this.accountId);
    const payToId = AccountId.fromString(requirements.payTo);
    const feePayerId = AccountId.fromString(feePayer);

    const tx = new TransferTransaction();

    if (isHbarAsset(requirements.asset)) {
      tx.addHbarTransfer(payerId, Hbar.fromTinybars((-amount).toString()));
      tx.addHbarTransfer(payToId, Hbar.fromTinybars(amount.toString()));
    } else {
      const tokenId = TokenId.fromString(requirements.asset);
      tx.addTokenTransfer(tokenId, payerId, -amount);
      tx.addTokenTransfer(tokenId, payToId, amount);
    }

    tx.setTransactionId(TransactionId.generate(feePayerId));

    const network = requirements.network || HEDERA_TESTNET_CAIP2;
    const client = createHederaClient(network, this.config.nodeUrl);

    try {
      tx.freezeWith(client);
      const signed = await tx.sign(this.privateKey);
      return Buffer.from(signed.toBytes()).toString('base64');
    } finally {
      client.close();
    }
  }
}
