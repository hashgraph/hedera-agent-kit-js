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
import {
  approveNftAllowanceTool,
  deleteNftAllowanceTool,
} from '@hashgraph/hedera-agent-kit/plugins';
import { approveNftAllowanceParameters } from '@hashgraph/hedera-agent-kit';
import { deleteNftAllowanceParameters } from '@hashgraph/hedera-agent-kit';
import { createLangchainTestSetup, type LangchainTestSetup } from '@tests/utils';
import {
  getProfile,
  HederaOperationsWrapper,
  type TestAccount,
  waitForMirrorTx,
} from '@hashgraph/hedera-agent-kit-tests';
import { z } from 'zod';

/**
 * E2E test: Create an HTS NFT, approve NFT allowance for a spender, delete the allowance,
 * and verify the spender can no longer transfer the NFT.
 */

describe('Delete NFT Allowance E2E', () => {
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
      tokenName: 'AK-NFT-DELETE-E2E',
      tokenSymbol: 'AKNDE',
      tokenMemo: 'Delete NFT allowance E2E',
      tokenType: TokenType.NonFungibleUnique,
      supplyType: TokenSupplyType.Finite,
      maxSupply: 10,
      adminKey: owner.privateKey.publicKey as PublicKey,
      supplyKey: owner.privateKey.publicKey as PublicKey,
      treasuryAccountId: owner.accountId.toString(),
      autoRenewAccountId: owner.accountId.toString(),
    });
    nftTokenId = createResp.tokenId!.toString();

    // 6) Mint 2 serials for the NFT
    const mintTx = new TokenMintTransaction()
      .setTokenId(TokenId.fromString(nftTokenId))
      .setMetadata([Buffer.from('ipfs://meta-1.json'), Buffer.from('ipfs://meta-2.json')]);
    const mintResp = await mintTx.execute(ownerClient);
    await mintResp.getReceipt(ownerClient);

    // 7) Associate spender and recipient with the NFT token
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
    'should delete specific serial NFT allowance and prevent spender from transferring',
    async () => {
      // 1) Approve NFT allowance for serial 1
      const approveTool = approveNftAllowanceTool({});
      const approveParams: z.infer<ReturnType<typeof approveNftAllowanceParameters>> = {
        ownerAccountId: owner.accountId.toString(),
        spenderAccountId: spender.accountId.toString(),
        tokenId: nftTokenId,
        serialNumbers: [serialToUse],
        transactionMemo: 'E2E approve NFT allowance for delete test',
      };
      const approveResult = await approveTool.execute(ownerClient, {}, approveParams);
      expect(approveResult.raw.status).toBe('SUCCESS');

      await waitForMirrorTx(ownerWrapper, approveResult.raw.transactionId!);

      // 2) Delete NFT allowance for serial 1
      const deleteTool = deleteNftAllowanceTool({});
      const deleteParams: z.infer<ReturnType<typeof deleteNftAllowanceParameters>> = {
        ownerAccountId: owner.accountId.toString(),
        tokenId: nftTokenId,
        serialNumbers: [serialToUse],
        transactionMemo: 'E2E delete NFT allowance',
      };
      const deleteResult = await deleteTool.execute(ownerClient, {}, deleteParams);
      expect(deleteResult.raw.status).toBe('SUCCESS');

      await waitForMirrorTx(ownerWrapper, deleteResult.raw.transactionId!);

      // 3) Verify spender can no longer transfer the NFT
      const nft = new NftId(TokenId.fromString(nftTokenId), serialToUse);
      const tx = new TransferTransaction().addApprovedNftTransfer(
        nft,
        AccountId.fromString(owner.accountId.toString()),
        AccountId.fromString(recipient.accountId.toString()),
      );

      // Expect the transfer to fail because allowance was deleted
      await expect(async () => {
        const exec = await tx.execute(spenderClient);
        await exec.getReceipt(spenderClient);
      }).rejects.toThrow(/SPENDER_DOES_NOT_HAVE_ALLOWANCE|INVALID_ALLOWANCE_OWNER_ID/);
    },
    180_000,
  );

  it(
    'should delete multiple serial NFT allowances',
    async () => {
      const serialsToUse = [1, 2];

      // 1) Approve NFT allowances for serials 1 and 2
      const approveTool = approveNftAllowanceTool({});
      const approveParams: z.infer<ReturnType<typeof approveNftAllowanceParameters>> = {
        ownerAccountId: owner.accountId.toString(),
        spenderAccountId: spender.accountId.toString(),
        tokenId: nftTokenId,
        serialNumbers: serialsToUse,
        transactionMemo: 'E2E approve multiple NFT allowances',
      };
      const approveResult = await approveTool.execute(ownerClient, {}, approveParams);
      expect(approveResult.raw.status).toBe('SUCCESS');

      await waitForMirrorTx(ownerWrapper, approveResult.raw.transactionId!);

      // 2) Delete NFT allowances for serials 1 and 2
      const deleteTool = deleteNftAllowanceTool({});
      const deleteParams: z.infer<ReturnType<typeof deleteNftAllowanceParameters>> = {
        ownerAccountId: owner.accountId.toString(),
        tokenId: nftTokenId,
        serialNumbers: serialsToUse,
        transactionMemo: 'E2E delete multiple NFT allowances',
      };
      const deleteResult = await deleteTool.execute(ownerClient, {}, deleteParams);
      expect(deleteResult.raw.status).toBe('SUCCESS');

      await waitForMirrorTx(ownerWrapper, deleteResult.raw.transactionId!);

      // 3) Verify spender can no longer transfer serial 1
      const nft1 = new NftId(TokenId.fromString(nftTokenId), 1);
      const tx1 = new TransferTransaction().addApprovedNftTransfer(
        nft1,
        AccountId.fromString(owner.accountId.toString()),
        AccountId.fromString(recipient.accountId.toString()),
      );

      await expect(async () => {
        const exec = await tx1.execute(spenderClient);
        await exec.getReceipt(spenderClient);
      }).rejects.toThrow(/SPENDER_DOES_NOT_HAVE_ALLOWANCE|INVALID_ALLOWANCE_OWNER_ID/);
    },
    180_000,
  );
});
