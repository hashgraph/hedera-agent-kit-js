import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client, PublicKey, TokenType, TokenSupplyType } from '@hiero-ledger/sdk';
import { AgentMode, type Context } from '@/shared/configuration';
import {
  getProfile,
  HederaOperationsWrapper,
  type TestAccount,
} from '@hashgraph/hedera-agent-kit-tests';
import transferNonFungibleToken from '@/plugins/core-token-plugin/tools/non-fungible-token/transfer-non-fungible-token';
import { mintNonFungibleTokenParametersNormalised } from '@/shared/parameter-schemas/token.zod';
import { z } from 'zod';
import { waitForMirrorTx } from '@hashgraph/hedera-agent-kit-tests';

describe('Transfer NFT Integration Tests', () => {
  const profile = getProfile();
  let owner: TestAccount;
  let recipient: TestAccount;
  let ownerClient: Client;
  let recipientClient: Client;
  let ownerWrapper: HederaOperationsWrapper;
  let recipientWrapper: HederaOperationsWrapper;
  let nftTokenId: string;
  let context: Context;

  beforeAll(async () => {
    owner = await profile.accounts.acquire({ tier: 'ELEVATED' });
    ({ client: ownerClient, wrapper: ownerWrapper } = profile.client.connectAs(owner));

    recipient = await profile.accounts.acquire({ tier: 'STANDARD' });
    ({ client: recipientClient, wrapper: recipientWrapper } = profile.client.connectAs(recipient));

    // Context for tool execution (owner executes)
    context = {
      mode: AgentMode.AUTONOMOUS,
      accountId: owner.accountId.toString(),
    };

    // Create NFT token
    const tokenCreate = await ownerWrapper.createNonFungibleToken({
      tokenName: 'TestNFT',
      tokenSymbol: 'TNFT',
      tokenMemo: 'Transfer integration test',
      tokenType: TokenType.NonFungibleUnique,
      supplyType: TokenSupplyType.Finite,
      maxSupply: 10,
      treasuryAccountId: owner.accountId.toString(),
      adminKey: owner.privateKey.publicKey as PublicKey,
      supplyKey: owner.privateKey.publicKey as PublicKey,
      autoRenewAccountId: owner.accountId.toString(),
    });
    nftTokenId = tokenCreate.tokenId!.toString();

    const mintParams: z.infer<ReturnType<typeof mintNonFungibleTokenParametersNormalised>> = {
      tokenId: nftTokenId,
      metadata: [
        new TextEncoder().encode('ipfs://meta-1.json'),
        new TextEncoder().encode('ipfs://meta-2.json'),
      ],
    };

    await ownerWrapper.mintNft(mintParams);

    await recipientWrapper.associateToken({
      accountId: recipient.accountId.toString(),
      tokenId: nftTokenId,
    });
  });

  afterAll(async () => {
    await profile.accounts.release(recipient);
    await profile.accounts.release(owner);
    ownerClient?.close();
    recipientClient?.close();
  });

  it('should transfer NFT from owner to recipient', async () => {
    const params = {
      tokenId: nftTokenId,
      recipients: [{ recipientId: recipient.accountId.toString(), serialNumber: 1 }],
      transactionMemo: 'NFT transfer test',
    };

    const tool = transferNonFungibleToken(context);
    const result = await tool.execute(ownerClient, context, params);

    expect(result.raw.status).toBe('SUCCESS');
    expect(result.humanMessage).toContain(
      'Non-fungible tokens successfully transferred. Transaction ID:',
    );

    await waitForMirrorTx(ownerWrapper, result.raw.transactionId);
    const recipientNfts = await recipientWrapper.getAccountNfts(recipient.accountId.toString());
    expect(
      recipientNfts.nfts.find(nft => nft.token_id === nftTokenId && nft.serial_number === 1),
    ).toBeTruthy();
  });

  it('should transfer multiple NFTs to the same recipient', async () => {
    const params = {
      tokenId: nftTokenId,
      recipients: [{ recipientId: recipient.accountId.toString(), serialNumber: 2 }],
      transactionMemo: 'NFT transfer second serial',
    };

    const tool = transferNonFungibleToken(context);
    const result = await tool.execute(ownerClient, context, params);

    expect(result.raw.status).toBe('SUCCESS');

    await waitForMirrorTx(ownerWrapper, result.raw.transactionId);
    const recipientNfts = await recipientWrapper.getAccountNfts(recipient.accountId.toString());
    expect(
      recipientNfts.nfts.find(nft => nft.token_id === nftTokenId && nft.serial_number === 2),
    ).toBeTruthy();
  });

  it('should fail when trying to transfer NFT not owned', async () => {
    // Recipient trying to transfer an NFT they don't own
    const recipientContext: Context = {
      mode: AgentMode.AUTONOMOUS,
      accountId: recipient.accountId.toString(),
    };

    const params = {
      tokenId: nftTokenId,
      recipients: [{ recipientId: owner.accountId.toString(), serialNumber: 99 }], // non-existent serial
    };

    const tool = transferNonFungibleToken(recipientContext);
    const result = await tool.execute(recipientClient, recipientContext, params);

    expect(result.raw.status).toBe('ERROR');
    expect(result.raw.errorCode).toBe('INVALID_NFT_ID');
    expect(result.raw.transactionId).toBeDefined();
    expect(result.humanMessage).toContain('Failed to execute Transfer Non Fungible Token');
  });

  it('should schedule an NFT transfer', async () => {
    const params = {
      tokenId: nftTokenId,
      recipients: [{ recipientId: recipient.accountId.toString(), serialNumber: 3 }],
      transactionMemo: 'Scheduled NFT transfer test',
      schedulingParams: {
        isScheduled: true,
      },
    };

    const tool = transferNonFungibleToken(context);
    const result = await tool.execute(ownerClient, context, params);

    expect(result.raw.status).toBe('SUCCESS');
    expect(result.humanMessage).toContain(
      'Scheduled non-fungible token transfer created successfully',
    );
    expect(result.humanMessage).toContain('Schedule ID:');
  });
});
