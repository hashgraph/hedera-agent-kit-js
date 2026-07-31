import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { Client, TokenId, TokenSupplyType } from '@hiero-ledger/sdk';
import {
  getProfile,
  HederaOperationsWrapper,
  type TestAccount,
  waitForMirrorTx,
} from '@hashgraph/hedera-agent-kit-tests';
import transferFungibleTokenTool from '@/plugins/core-token-plugin/tools/fungible-token/transfer-fungible-token';
import { z } from 'zod';
import { transferFungibleTokenParameters } from '@/shared/parameter-schemas/token.zod';
import { AgentMode, type Context } from '@/shared/configuration';

describe('Transfer Fungible Token Tool Integration', () => {
  const profile = getProfile();
  let executor: TestAccount;
  let receiver: TestAccount;
  let executorClient: Client;
  let executorWrapper: HederaOperationsWrapper;
  let receiverWrapper: HederaOperationsWrapper;
  let tokenId: TokenId;
  let context: Context;

  const FT_PARAMS = {
    tokenName: 'IntegrationTransferToken',
    tokenSymbol: 'ITT',
    tokenMemo: 'FT for direct transfer integration tests',
    initialSupply: 1000,
    decimals: 0,
    maxSupply: 10000,
    supplyType: TokenSupplyType.Finite,
  };

  beforeAll(async () => {
    executor = await profile.accounts.acquire({ tier: 'MAXIMUM' });
    ({ client: executorClient, wrapper: executorWrapper } = profile.client.connectAs(executor));

    tokenId = await executorWrapper
      .createFungibleToken({
        ...FT_PARAMS,
        treasuryAccountId: executor.accountId.toString(),
        supplyKey: executor.privateKey.publicKey,
        adminKey: executor.privateKey.publicKey,
        autoRenewAccountId: executor.accountId.toString(),
      })
      .then(r => r.tokenId!);

    context = {
      mode: AgentMode.AUTONOMOUS,
      accountId: executor.accountId.toString(),
    };
  });

  afterAll(async () => {
    await profile.accounts.release(executor);
    executorClient?.close();
  });

  beforeEach(async () => {
    receiver = await profile.accounts.acquire({ tier: 'STANDARD' });
    ({ wrapper: receiverWrapper } = profile.client.connectAs(receiver));

    await receiverWrapper.associateToken({
      accountId: receiver.accountId.toString(),
      tokenId: tokenId.toString(),
    });
  });

  afterEach(async () => {
    await profile.accounts.release(receiver);
  });

  it('should transfer fungible tokens to a single recipient', async () => {
    const tool = transferFungibleTokenTool(context);
    const params: z.infer<ReturnType<typeof transferFungibleTokenParameters>> = {
      tokenId: tokenId.toString(),
      transfers: [{ accountId: receiver.accountId.toString(), amount: 50 }],
    };

    const result: any = await tool.execute(executorClient, context, params);

    expect(result.humanMessage).toContain('Fungible tokens successfully transferred');
    expect(result.raw.status).toBe('SUCCESS');

    await waitForMirrorTx(executorWrapper, result.raw.transactionId);

    const receiverBalance = await receiverWrapper.getAccountTokenBalanceFromMirrornode(
      receiver.accountId.toString(),
      tokenId.toString(),
    );
    expect(receiverBalance.balance).toBe(50);
  });

  it('should transfer fungible tokens to multiple recipients in one transaction', async () => {
    const receiver2 = await profile.accounts.acquire({ tier: 'STANDARD' });
    const { wrapper: receiver2Wrapper } = profile.client.connectAs(receiver2);

    await receiver2Wrapper.associateToken({
      accountId: receiver2.accountId.toString(),
      tokenId: tokenId.toString(),
    });

    const tool = transferFungibleTokenTool(context);
    const params: z.infer<ReturnType<typeof transferFungibleTokenParameters>> = {
      tokenId: tokenId.toString(),
      transfers: [
        { accountId: receiver.accountId.toString(), amount: 30 },
        { accountId: receiver2.accountId.toString(), amount: 70 },
      ],
    };

    const result: any = await tool.execute(executorClient, context, params);

    expect(result.humanMessage).toContain('Fungible tokens successfully transferred');
    expect(result.raw.status).toBe('SUCCESS');

    await waitForMirrorTx(executorWrapper, result.raw.transactionId);

    const [bal1, bal2] = await Promise.all([
      receiverWrapper.getAccountTokenBalanceFromMirrornode(
        receiver.accountId.toString(),
        tokenId.toString(),
      ),
      receiver2Wrapper.getAccountTokenBalanceFromMirrornode(
        receiver2.accountId.toString(),
        tokenId.toString(),
      ),
    ]);

    expect(bal1.balance).toBe(30);
    expect(bal2.balance).toBe(70);

    await profile.accounts.release(receiver2);
  });

  it('should transfer using an explicit senderAccountId', async () => {
    const tool = transferFungibleTokenTool(context);
    const params: z.infer<ReturnType<typeof transferFungibleTokenParameters>> = {
      tokenId: tokenId.toString(),
      senderAccountId: executor.accountId.toString(),
      transfers: [{ accountId: receiver.accountId.toString(), amount: 10 }],
      transactionMemo: 'explicit sender test',
    };

    const result: any = await tool.execute(executorClient, context, params);

    expect(result.humanMessage).toContain('Fungible tokens successfully transferred');
    expect(result.raw.status).toBe('SUCCESS');
  });

  it('should create a scheduled transfer transaction', async () => {
    const tool = transferFungibleTokenTool(context);
    const params: z.infer<ReturnType<typeof transferFungibleTokenParameters>> = {
      tokenId: tokenId.toString(),
      transfers: [{ accountId: receiver.accountId.toString(), amount: 5 }],
      schedulingParams: {
        isScheduled: true,
        waitForExpiry: false,
        adminKey: false,
      },
    };

    const result: any = await tool.execute(executorClient, context, params);

    expect(result.humanMessage).toContain('Scheduled fungible token transfer created successfully');
    expect(result.raw.status).toBe('SUCCESS');
    expect(result.raw.scheduleId).toBeDefined();
  });

  it('should fail gracefully when transferring more tokens than available balance', async () => {
    const tool = transferFungibleTokenTool(context);
    const params: z.infer<ReturnType<typeof transferFungibleTokenParameters>> = {
      tokenId: tokenId.toString(),
      transfers: [{ accountId: receiver.accountId.toString(), amount: 999999 }],
    };

    const result: any = await tool.execute(executorClient, context, params);

    expect(result.raw.status).toBe('ERROR');
    expect(result.humanMessage).toContain('Failed to execute Transfer Fungible Token');
  });
});
