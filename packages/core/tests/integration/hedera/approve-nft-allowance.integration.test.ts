import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  Client,
  PublicKey,
  TokenId,
  TokenMintTransaction,
  TokenSupplyType,
  TokenType,
} from '@hiero-ledger/sdk';
import approveNftAllowanceTool from '@/plugins/core-token-plugin/tools/non-fungible-token/approve-non-fungible-token-allowance';
import { AgentMode, type Context } from '@/shared/configuration';
import {
  getProfile,
  HederaOperationsWrapper,
  type TestAccount,
} from '@hashgraph/hedera-agent-kit-tests';
import { z } from 'zod';
import { approveNftAllowanceParameters } from '@/shared/parameter-schemas/token.zod';
import { wait } from '@hashgraph/hedera-agent-kit-tests';
import { MIRROR_NODE_WAITING_TIME } from '@hashgraph/hedera-agent-kit-tests';

/**
 * Integration tests for Approve NFT Allowance tool
 *
 * - Transaction succeeds with SUCCESS status and includes a transaction ID
 * - Works with an explicit owner and memo
 * - Works when ownerAccountId is omitted (defaults to context operator)
 * - Approves multiple NFT serial numbers at once
 */

describe('Approve NFT Allowance Integration Tests', () => {
  const profile = getProfile();
  let executor: TestAccount;
  let spender: TestAccount;
  let executorClient: Client;
  let spenderClient: Client;
  let executorWrapper: HederaOperationsWrapper;
  let spenderWrapper: HederaOperationsWrapper;
  let context: Context;

  // NFT setup
  let nftTokenId: string;

  beforeAll(async () => {
    executor = await profile.accounts.acquire({ tier: 'ELEVATED' });
    ({ client: executorClient, wrapper: executorWrapper } = profile.client.connectAs(executor));

    spender = await profile.accounts.acquire({ tier: 'STANDARD' });
    ({ client: spenderClient, wrapper: spenderWrapper } = profile.client.connectAs(spender));

    context = {
      mode: AgentMode.AUTONOMOUS,
      accountId: executor.accountId.toString(),
    };

    // Create an NFT token with executor as treasury and supply/admin keys
    const createNftResp = await executorWrapper.createNonFungibleToken({
      tokenName: 'AK-NFT',
      tokenSymbol: 'AKN',
      tokenMemo: 'Approve allowance integration',
      tokenType: TokenType.NonFungibleUnique,
      supplyType: TokenSupplyType.Finite,
      maxSupply: 100,
      adminKey: executor.privateKey.publicKey as PublicKey,
      supplyKey: executor.privateKey.publicKey as PublicKey,
      treasuryAccountId: executor.accountId.toString(),
      autoRenewAccountId: executor.accountId.toString(),
    });
    nftTokenId = createNftResp.tokenId!.toString();

    // Mint a few NFTs so we have serial numbers to approve (use SDK directly, not another tool)
    const mintTx = new TokenMintTransaction()
      .setTokenId(TokenId.fromString(nftTokenId))
      .setMetadata([
        Buffer.from('ipfs://meta-a.json'),
        Buffer.from('ipfs://meta-b.json'),
        Buffer.from('ipfs://meta-c.json'),
      ]);
    const mintResp = await mintTx.execute(executorClient);
    await mintResp.getReceipt(executorClient);

    // Give mirror node a moment where needed in case subsequent queries happen
    await wait(MIRROR_NODE_WAITING_TIME);

    // Associate spender with the NFT token to ensure they can receive transfers later if needed
    await spenderWrapper.associateToken({
      accountId: spender.accountId.toString(),
      tokenId: nftTokenId,
    });
  });

  afterAll(async () => {
    await profile.accounts.release(spender);
    await profile.accounts.release(executor);
    executorClient?.close();
    spenderClient?.close();
  });

  it('approves NFT allowance with explicit owner and memo for a single serial', async () => {
    const params: z.infer<ReturnType<typeof approveNftAllowanceParameters>> = {
      ownerAccountId: context.accountId!,
      spenderAccountId: spender.accountId.toString(),
      tokenId: nftTokenId,
      serialNumbers: [1],
      transactionMemo: 'Approve NFT allowance (single) integration test',
    };

    const tool = approveNftAllowanceTool(context);
    const result = await tool.execute(executorClient, context, params);

    expect(result.humanMessage).toContain('NFT allowance approved successfully');
    expect(result.humanMessage).toContain('Transaction ID:');
    expect(result.raw.status).toBe('SUCCESS');
    expect(result.raw.transactionId).toBeDefined();
  });

  it('approves NFT allowance using default owner (from context) for multiple serials', async () => {
    const params: z.infer<ReturnType<typeof approveNftAllowanceParameters>> = {
      spenderAccountId: spender.accountId.toString(),
      tokenId: nftTokenId,
      serialNumbers: [2, 3],
    };

    const tool = approveNftAllowanceTool(context);
    const result = await tool.execute(executorClient, context, params);

    expect(result.humanMessage).toContain('NFT allowance approved successfully');
    expect(result.humanMessage).toContain('Transaction ID:');
    expect(result.raw.status).toBe('SUCCESS');
    expect(result.raw.transactionId).toBeDefined();
  });
});
