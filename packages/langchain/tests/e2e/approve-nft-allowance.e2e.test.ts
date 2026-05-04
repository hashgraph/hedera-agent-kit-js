import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  AccountId,
  Client,
  NftId,
  PublicKey,
  TokenId,
  TokenMintTransaction,
  TokenSupplyType,
  TokenType,
  TransferTransaction,
} from '@hiero-ledger/sdk';
import { approveNftAllowanceTool } from '@hashgraph/hedera-agent-kit/plugins';
import { approveNftAllowanceParameters } from '@hashgraph/hedera-agent-kit';
import { createLangchainTestSetup, type LangchainTestSetup } from '@tests/utils';
import {
  getProfile,
  HederaOperationsWrapper,
  type TestAccount,
  waitForMirrorTx,
} from '@hashgraph/hedera-agent-kit-tests';
import { z } from 'zod';

/**
 * E2E test: Create an HTS NFT, approve NFT allowance for a spender, then verify the spender
 * can transfer the NFT using an approved transfer.
 */

describe('Approve NFT Allowance E2E', () => {
  const profile = getProfile();
  let testSetup: LangchainTestSetup;

  let owner: TestAccount;
  let ownerClient: Client; // owner/treasury/executor
  let ownerWrapper: HederaOperationsWrapper;

  let spender: TestAccount;
  let spenderClient: Client;
  let spenderWrapper: HederaOperationsWrapper;

  let nftTokenId: string;
  const serialToUse = 1; // we'll mint at least one NFT and use serial 1

  let recipient: TestAccount;
  let recipientClient: Client;
  let recipientWrapper: HederaOperationsWrapper;

  beforeAll(async () => {
    // 1) Create owner (executor) account and client
    owner = await profile.accounts.acquire({ tier: 'STANDARD' });
    ({ client: ownerClient, wrapper: ownerWrapper } = profile.client.connectAs(owner));

    // 2) Create a spender account with its own key and client
    spender = await profile.accounts.acquire({ tier: 'STANDARD' });
    ({ client: spenderClient, wrapper: spenderWrapper } = profile.client.connectAs(spender));

    // 3) Create a separate recipient account
    recipient = await profile.accounts.acquire({ tier: 'STANDARD' });
    ({ client: recipientClient, wrapper: recipientWrapper } = profile.client.connectAs(recipient));

    // 4) Start LangChain test setup with the owner client
    testSetup = await createLangchainTestSetup(undefined, undefined, ownerClient);

    // 5) Create an HTS NFT with an owner as treasury/admin/supply keys
    const createResp = await ownerWrapper.createNonFungibleToken({
      tokenName: 'AK-NFT-E2E',
      tokenSymbol: 'AKNE',
      tokenMemo: 'Approve NFT allowance E2E',
      tokenType: TokenType.NonFungibleUnique,
      supplyType: TokenSupplyType.Finite,
      maxSupply: 10,
      adminKey: owner.privateKey.publicKey as PublicKey,
      supplyKey: owner.privateKey.publicKey as PublicKey,
      treasuryAccountId: owner.accountId.toString(),
      autoRenewAccountId: owner.accountId.toString(),
    });
    nftTokenId = createResp.tokenId!.toString();

    // 6) Mint at least one serial for the NFT using the SDK directly (no other tool)
    const mintTx = new TokenMintTransaction()
      .setTokenId(TokenId.fromString(nftTokenId))
      .setMetadata([Buffer.from('ipfs://meta-1.json')]);
    const mintResp = await mintTx.execute(ownerClient);
    await mintResp.getReceipt(ownerClient);

    // 7) Associate spender and recipient with the NFT token (must be signed by each account)
    await spenderWrapper.associateToken({
      accountId: spender.accountId.toString(),
      tokenId: nftTokenId,
    });
    const recipAssocResp = await recipientWrapper.associateToken({
      accountId: recipient.accountId.toString(),
      tokenId: nftTokenId,
    });

    await waitForMirrorTx(ownerWrapper, recipAssocResp.transactionId!);
  }, 180_000);

  afterAll(async () => {
    await profile.accounts.release(recipient);
    await profile.accounts.release(spender);
    await profile.accounts.release(owner);
    testSetup?.cleanup();
    ownerClient?.close();
    spenderClient?.close();
    recipientClient?.close();
  });

  it(
    'should approve NFT allowance and allow spender to transfer via approved transfer',
    async () => {
      // Approve NFT allowance (explicit tool invocation for determinism)
      const approveTool = approveNftAllowanceTool({});
      const approveParams: z.infer<ReturnType<typeof approveNftAllowanceParameters>> = {
        ownerAccountId: owner.accountId.toString(),
        spenderAccountId: spender.accountId.toString(),
        tokenId: nftTokenId,
        serialNumbers: [serialToUse],
        transactionMemo: 'E2E approve NFT allowance',
      };
      const approveResult = await approveTool.execute(ownerClient, {}, approveParams);
      expect(approveResult.raw.status).toBe('SUCCESS');

      // Give the network a moment to process the allowance
      await waitForMirrorTx(ownerWrapper, approveResult.raw.transactionId!);

      // Now, using a spender client, perform an approved NFT transfer from owner to recipient via SDK directly
      const nft = new NftId(TokenId.fromString(nftTokenId), serialToUse);
      const tx = new TransferTransaction().addApprovedNftTransfer(
        nft,
        AccountId.fromString(owner.accountId.toString()),
        AccountId.fromString(recipient.accountId.toString()),
      );
      const exec = await tx.execute(spenderClient);
      const rcpt = await exec.getReceipt(spenderClient);
      expect(rcpt.status.toString()).toBe('SUCCESS');

      // Optional: verify ownership moved to recipient
      const nftInfo = await spenderWrapper.getNftInfo(nftTokenId, serialToUse);
      expect(nftInfo).toBeDefined();
      // @ts-ignore checked above
      expect(nftInfo.at(0).accountId?.toString()).toBe(recipient.accountId.toString());
    },
    180_000,
  );
});
