import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import {
  Client,
  TokenId,
  TokenSupplyType,
  TokenAllowance,
  Long,
} from '@hiero-ledger/sdk';
import {
  getProfile,
  HederaOperationsWrapper,
  type TestAccount,
} from '@hashgraph/hedera-agent-kit-tests';
import transferFungibleTokenWithAllowanceTool from '@/plugins/core-token-plugin/tools/fungible-token/transfer-fungible-token-with-allowance';
import { z } from 'zod';
import { transferFungibleTokenWithAllowanceParameters } from '@/shared/parameter-schemas/token.zod';
import { waitForMirrorTx } from '@hashgraph/hedera-agent-kit-tests';

describe('Transfer Fungible Token With Allowance Tool Integration', () => {
  const profile = getProfile();
  let executor: TestAccount;
  let spender: TestAccount;
  let receiver: TestAccount;

  let executorClient: Client;
  let spenderClient: Client;
  let receiverClient: Client;

  let executorWrapper: HederaOperationsWrapper;
  let spenderWrapper: HederaOperationsWrapper;
  let receiverWrapper: HederaOperationsWrapper;

  let tokenId: TokenId;

  const FT_PARAMS = {
    tokenName: 'IntegrationAllowanceToken',
    tokenSymbol: 'IAT',
    tokenMemo: 'FT for integration allowance tests',
    initialSupply: 1000,
    decimals: 0,
    maxSupply: 10000,
    supplyType: TokenSupplyType.Finite,
  };

  beforeAll(async () => {
    executor = await profile.accounts.acquire({ tier: 'MAXIMUM' });
    ({ client: executorClient, wrapper: executorWrapper } = profile.client.connectAs(executor));

    // Create fungible token
    tokenId = await executorWrapper
      .createFungibleToken({
        ...FT_PARAMS,
        treasuryAccountId: executor.accountId.toString(),
        supplyKey: executor.privateKey.publicKey,
        adminKey: executor.privateKey.publicKey,
        autoRenewAccountId: executor.accountId.toString(),
      })
      .then(r => r.tokenId!);
  });

  afterAll(async () => {
    await profile.accounts.release(executor);
    executorClient?.close();
  });

  beforeEach(async () => {
    spender = await profile.accounts.acquire({ tier: 'STANDARD' });
    ({ client: spenderClient, wrapper: spenderWrapper } = profile.client.connectAs(spender));

    receiver = await profile.accounts.acquire({ tier: 'STANDARD' });
    ({ client: receiverClient, wrapper: receiverWrapper } = profile.client.connectAs(receiver));

    // Associate token
    await spenderWrapper.associateToken({
      accountId: spender.accountId.toString(),
      tokenId: tokenId.toString(),
    });
    await receiverWrapper.associateToken({
      accountId: receiver.accountId.toString(),
      tokenId: tokenId.toString(),
    });

    // Approve allowance
    await executorWrapper.approveTokenAllowance({
      tokenApprovals: [
        new TokenAllowance({
          tokenId,
          ownerAccountId: executor.accountId,
          spenderAccountId: spender.accountId,
          amount: Long.fromNumber(200),
        }),
      ],
    });
  });

  afterEach(async () => {
    await profile.accounts.release(spender);
    await profile.accounts.release(receiver);
    spenderClient?.close();
    receiverClient?.close();
  });

  it.skip('should allow spender to transfer tokens to themselves using allowance', async () => {
    const context = {}; // optional tool context
    const tool = transferFungibleTokenWithAllowanceTool(context);

    const params: z.infer<ReturnType<typeof transferFungibleTokenWithAllowanceParameters>> = {
      tokenId: tokenId.toString(),
      sourceAccountId: executor.accountId.toString(),
      transfers: [
        {
          accountId: spender.accountId.toString(),
          amount: 50,
        },
      ],
    };

    const result: any = await tool.execute(spenderClient, context, params);

    expect(result.humanMessage).toContain(
      'Fungible tokens successfully transferred with allowance',
    );
    expect(result.raw.status).toBe('SUCCESS');

    //FIXME: this breaks somehow

    const spenderBalance = await spenderWrapper.getAccountTokenBalance(
      tokenId.toString(),
      spender.accountId.toString(),
    );

    expect(spenderBalance.balance).toBe(50);
  });

  it.skip('should allow spender to transfer tokens to themselves and receiver using allowance', async () => {
    const context = {};
    const tool = transferFungibleTokenWithAllowanceTool(context);

    const params: z.infer<ReturnType<typeof transferFungibleTokenWithAllowanceParameters>> = {
      tokenId: tokenId.toString(),
      sourceAccountId: executor.accountId.toString(),
      transfers: [
        { accountId: spender.accountId.toString(), amount: 30 },
        { accountId: receiver.accountId.toString(), amount: 70 },
      ],
    };

    const result: any = await tool.execute(spenderClient, context, params);

    expect(result.humanMessage).toContain(
      'Fungible tokens successfully transferred with allowance',
    );
    expect(result.raw.status).toBe('SUCCESS');

    await waitForMirrorTx(executorWrapper, result.raw.transactionId);

    // FIXME: the <xyz>Wrapper.getAccountTokenBalance() calls are failing with INVALID_ACCOUNT_ID and tx id 0.0.0@...
    // using mirrornode instead is a workaround
    const spenderBalance = await spenderWrapper.getAccountTokenBalanceFromMirrornode(
      spender.accountId.toString(),
      tokenId.toString(),
    );
    const receiverBalance = await receiverWrapper.getAccountTokenBalanceFromMirrornode(
      receiver.accountId.toString(),
      tokenId.toString(),
    );

    expect(spenderBalance.balance).toBe(30);
    expect(receiverBalance.balance).toBe(70);
  });

  it('should schedule transfer with allowance', async () => {
    const context = {};
    const tool = transferFungibleTokenWithAllowanceTool(context);

    const params: z.infer<ReturnType<typeof transferFungibleTokenWithAllowanceParameters>> = {
      tokenId: tokenId.toString(),
      sourceAccountId: executor.accountId.toString(),
      transfers: [
        { accountId: spender.accountId.toString(), amount: 30 },
        { accountId: receiver.accountId.toString(), amount: 70 },
      ],
      schedulingParams: {
        isScheduled: true,
        waitForExpiry: false,
        adminKey: false,
      },
    };

    const result: any = await tool.execute(spenderClient, context, params);

    expect(result.humanMessage).toContain('Scheduled allowance transfer created successfully.');
    expect(result.raw.status).toBe('SUCCESS');
  });

  it('should fail gracefully when trying to transfer more than allowance', async () => {
    const context = {};
    const tool = transferFungibleTokenWithAllowanceTool(context);

    const params: z.infer<ReturnType<typeof transferFungibleTokenWithAllowanceParameters>> = {
      tokenId: tokenId.toString(),
      sourceAccountId: executor.accountId.toString(),
      transfers: [{ accountId: spender.accountId.toString(), amount: 300 }],
    };

    const result: any = await tool.execute(spenderClient, context, params);

    expect(result.humanMessage).toContain('Failed to transfer fungible token with allowance');
    expect(result.humanMessage).toContain('AMOUNT_EXCEEDS_ALLOWANCE');
  });
});
