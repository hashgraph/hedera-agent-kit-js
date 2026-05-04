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
import approveNftAllowanceTool from '@/plugins/core-token-plugin/tools/non-fungible-token/approve-non-fungible-token-allowance';
import deleteNftAllowanceTool from '@/plugins/core-token-plugin/tools/non-fungible-token/delete-non-fungible-token-allowance';
import { AgentMode, type Context } from '@/shared/configuration';
import {
  getProfile,
  HederaOperationsWrapper,
  type TestAccount,
} from '@hashgraph/hedera-agent-kit-tests';
import { z } from 'zod';
import {
  approveNftAllowanceParameters,
  deleteNftAllowanceParameters,
} from '@/shared/parameter-schemas/token.zod';
import { waitForMirrorTx } from '@hashgraph/hedera-agent-kit-tests';

/**
 * Integration tests for Delete NFT Allowance tool
 *
 * - Transaction succeeds with SUCCESS status and includes a transaction ID
 * - Works with an explicit owner and memo
 * - Deletes allowances for multiple NFT serial numbers at once
 * - After deletion, spender cannot transfer the NFT via approved transfer
 */

describe('Delete NFT Allowance Integration Tests', () => {
  const profile = getProfile();
  let executor: TestAccount;
  let spender: TestAccount;
  let recipient: TestAccount;
  let executorClient: Client;
  let executorWrapper: HederaOperationsWrapper;
  let spenderClient: Client;
  let spenderWrapper: HederaOperationsWrapper;
  let recipientClient: Client;
  let recipientWrapper: HederaOperationsWrapper;
  let context: Context;

  // NFT setup
  let nftTokenId: string;

  beforeAll(async () => {
    executor = await profile.accounts.acquire({ tier: 'ELEVATED' });
    ({ client: executorClient, wrapper: executorWrapper } = profile.client.connectAs(executor));

    spender = await profile.accounts.acquire({ tier: 'STANDARD' });
    ({ client: spenderClient, wrapper: spenderWrapper } = profile.client.connectAs(spender));

    recipient = await profile.accounts.acquire({ tier: 'STANDARD' });
    ({ client: recipientClient, wrapper: recipientWrapper } = profile.client.connectAs(recipient));

    context = {
      mode: AgentMode.AUTONOMOUS,
      accountId: executor.accountId.toString(),
    };

    // Create an NFT token with executor as treasury and supply/admin keys
    const createNftResp = await executorWrapper.createNonFungibleToken({
      tokenName: 'AK-NFT-DELETE',
      tokenSymbol: 'AKND',
      tokenMemo: 'Delete allowance integration',
      tokenType: TokenType.NonFungibleUnique,
      supplyType: TokenSupplyType.Finite,
      maxSupply: 100,
      adminKey: executor.privateKey.publicKey as PublicKey,
      supplyKey: executor.privateKey.publicKey as PublicKey,
      treasuryAccountId: executor.accountId.toString(),
      autoRenewAccountId: executor.accountId.toString(),
    });
    nftTokenId = createNftResp.tokenId!.toString();

    // Mint a few NFTs so we have serial numbers to work with
    const mintTx = new TokenMintTransaction()
      .setTokenId(TokenId.fromString(nftTokenId))
      .setMetadata([
        Buffer.from('ipfs://meta-a.json'),
        Buffer.from('ipfs://meta-b.json'),
        Buffer.from('ipfs://meta-c.json'),
      ]);
    const mintResp = await mintTx.execute(executorClient);
    await mintResp.getReceipt(executorClient);

    await waitForMirrorTx(executorWrapper, mintResp.transactionId.toString());

    // Associate spender and recipient with the NFT token
    await spenderWrapper.associateToken({
      accountId: spender.accountId.toString(),
      tokenId: nftTokenId,
    });
    await recipientWrapper.associateToken({
      accountId: recipient.accountId.toString(),
      tokenId: nftTokenId,
    });
  });

  afterAll(async () => {
    await profile.accounts.release(recipient);
    await profile.accounts.release(spender);
    await profile.accounts.release(executor);
    executorClient?.close();
    spenderClient?.close();
    recipientClient?.close();
  });

  it('deletes NFT allowance with explicit owner and memo for a single serial', async () => {
    // First approve the allowance
    const approveParams: z.infer<ReturnType<typeof approveNftAllowanceParameters>> = {
      ownerAccountId: context.accountId!,
      spenderAccountId: spender.accountId.toString(),
      tokenId: nftTokenId,
      serialNumbers: [1],
      transactionMemo: 'Approve for delete test',
    };

    const approveTool = approveNftAllowanceTool(context);
    const approveResult = await approveTool.execute(executorClient, context, approveParams);
    expect(approveResult.raw.status).toBe('SUCCESS');

    await waitForMirrorTx(executorWrapper, approveResult.raw.transactionId);

    // Now delete the allowance
    const deleteParams: z.infer<ReturnType<typeof deleteNftAllowanceParameters>> = {
      ownerAccountId: context.accountId!,
      tokenId: nftTokenId,
      serialNumbers: [1],
      transactionMemo: 'Delete NFT allowance (single) integration test',
    };

    const tool = deleteNftAllowanceTool(context);
    const result = await tool.execute(executorClient, context, deleteParams);

    expect(result.humanMessage).toContain('NFT allowance(s) deleted successfully');
    expect(result.humanMessage).toContain('Transaction ID:');
    expect(result.raw.status).toBe('SUCCESS');
    expect(result.raw.transactionId).toBeDefined();
  });

  it('deletes NFT allowance using default owner (from context) for multiple serials', async () => {
    // First approve the allowances
    const approveParams: z.infer<ReturnType<typeof approveNftAllowanceParameters>> = {
      spenderAccountId: spender.accountId.toString(),
      tokenId: nftTokenId,
      serialNumbers: [2, 3],
    };

    const approveTool = approveNftAllowanceTool(context);
    const approveResult = await approveTool.execute(executorClient, context, approveParams);
    expect(approveResult.raw.status).toBe('SUCCESS');

    await waitForMirrorTx(executorWrapper, approveResult.raw.transactionId);

    // Now delete the allowances
    const deleteParams: z.infer<ReturnType<typeof deleteNftAllowanceParameters>> = {
      tokenId: nftTokenId,
      serialNumbers: [2, 3],
    };

    const tool = deleteNftAllowanceTool(context);
    const result = await tool.execute(executorClient, context, deleteParams);

    expect(result.humanMessage).toContain('NFT allowance(s) deleted successfully');
    expect(result.humanMessage).toContain('Transaction ID:');
    expect(result.raw.status).toBe('SUCCESS');
    expect(result.raw.transactionId).toBeDefined();
  });

  it('prevents spender from transferring NFT after allowance is deleted', async () => {
    // First approve the allowance
    const approveParams: z.infer<ReturnType<typeof approveNftAllowanceParameters>> = {
      ownerAccountId: context.accountId!,
      spenderAccountId: spender.accountId.toString(),
      tokenId: nftTokenId,
      serialNumbers: [1],
    };

    const approveTool = approveNftAllowanceTool(context);
    const approveResult = await approveTool.execute(executorClient, context, approveParams);

    await waitForMirrorTx(executorWrapper, approveResult.raw.transactionId);

    // Delete the allowance
    const deleteParams: z.infer<ReturnType<typeof deleteNftAllowanceParameters>> = {
      ownerAccountId: context.accountId!,
      tokenId: nftTokenId,
      serialNumbers: [1],
    };

    const deleteTool = deleteNftAllowanceTool(context);
    const deleteResult = await deleteTool.execute(executorClient, context, deleteParams);
    expect(deleteResult.raw.status).toBe('SUCCESS');

    await waitForMirrorTx(executorWrapper, deleteResult.raw.transactionId);

    // Attempt transfer with spender - should fail
    const nft = new NftId(TokenId.fromString(nftTokenId), 1);
    const tx = new TransferTransaction().addApprovedNftTransfer(
      nft,
      AccountId.fromString(context.accountId!),
      recipient.accountId,
    );

    await expect(async () => {
      const exec = await tx.execute(spenderClient);
      await exec.getReceipt(spenderClient);
    }).rejects.toThrow(/SPENDER_DOES_NOT_HAVE_ALLOWANCE|INVALID_ALLOWANCE_OWNER_ID/);
  });
});
