import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import {
  Client,
  PrivateKey,
  AccountId,
  TokenId,
  TokenSupplyType,
  TokenAllowance,
  Long,
} from '@hashgraph/sdk';
import { getOperatorClientForTests, getCustomClient, HederaOperationsWrapper } from '../../utils';
import { returnHbarsAndDeleteAccount } from '../../utils/teardown/account-teardown';
import transferFungibleTokenWithAllowanceTool from '@/plugins/core-token-plugin/tools/fungible-token/transfer-fungible-token-with-allowance';
import { z } from 'zod';
import { transferFungibleTokenWithAllowanceParameters } from '@/shared/parameter-schemas/token.zod';
import { wait } from '../../utils/general-util';
import { MIRROR_NODE_WAITING_TIME } from '../../utils/test-constants';

describe('Transfer Fungible Token With Allowance Tool Integration', () => {
  let operatorClient: Client;
  let executorClient: Client;
  let spenderClient: Client;
  let receiverClient: Client;

  let executorWrapper: HederaOperationsWrapper;
  let spenderWrapper: HederaOperationsWrapper;
  let receiverWrapper: HederaOperationsWrapper;

  let executorAccountId: AccountId;
  let spenderAccountId: AccountId;
  let receiverAccountId: AccountId;

  let spenderKey: PrivateKey;
  let receiverKey: PrivateKey;

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
    operatorClient = getOperatorClientForTests();
    const operatorWrapper = new HederaOperationsWrapper(operatorClient);

    // Executor account (token owner)
    const executorKey = PrivateKey.generateED25519();
    executorAccountId = await operatorWrapper
      .createAccount({ key: executorKey.publicKey, initialBalance: 50 })
      .then(r => r.accountId!);

    executorClient = getCustomClient(executorAccountId, executorKey);
    executorWrapper = new HederaOperationsWrapper(executorClient);

    // Create fungible token
    tokenId = await executorWrapper
      .createFungibleToken({
        ...FT_PARAMS,
        treasuryAccountId: executorAccountId.toString(),
        supplyKey: executorClient.operatorPublicKey!,
        adminKey: executorClient.operatorPublicKey!,
        autoRenewAccountId: executorAccountId.toString(),
      })
      .then(r => r.tokenId!);
  });

  afterAll(async () => {
    if (executorClient && operatorClient) {
      await returnHbarsAndDeleteAccount(
        executorWrapper,
        executorAccountId,
        operatorClient.operatorAccountId!,
      );
      executorClient.close();
      operatorClient.close();
    }
  });

  beforeEach(async () => {
    // Spender account
    spenderKey = PrivateKey.generateED25519();
    spenderAccountId = await executorWrapper
      .createAccount({ key: spenderKey.publicKey, initialBalance: 10 })
      .then(r => r.accountId!);

    spenderClient = getCustomClient(spenderAccountId, spenderKey);
    spenderWrapper = new HederaOperationsWrapper(spenderClient);

    // Receiver account
    receiverKey = PrivateKey.generateED25519();
    receiverAccountId = await executorWrapper
      .createAccount({ key: receiverKey.publicKey, initialBalance: 10 })
      .then(r => r.accountId!);

    receiverClient = getCustomClient(receiverAccountId, receiverKey);
    receiverWrapper = new HederaOperationsWrapper(receiverClient);

    // Associate token
    await spenderWrapper.associateToken({
      accountId: spenderAccountId.toString(),
      tokenId: tokenId.toString(),
    });
    await receiverWrapper.associateToken({
      accountId: receiverAccountId.toString(),
      tokenId: tokenId.toString(),
    });

    // Approve allowance
    await executorWrapper.approveTokenAllowance({
      tokenApprovals: [
        new TokenAllowance({
          tokenId,
          ownerAccountId: executorAccountId,
          spenderAccountId,
          amount: Long.fromNumber(200),
        }),
      ],
    });
  });

  afterEach(async () => {
    if (spenderAccountId) {
      await returnHbarsAndDeleteAccount(spenderWrapper, spenderAccountId, executorAccountId);
    }
    if (receiverAccountId) {
      await returnHbarsAndDeleteAccount(receiverWrapper, receiverAccountId, executorAccountId);
    }
  });

  it.skip('should allow spender to transfer tokens to themselves using allowance', async () => {
    const context = {}; // optional tool context
    const tool = transferFungibleTokenWithAllowanceTool(context);

    const params: z.infer<ReturnType<typeof transferFungibleTokenWithAllowanceParameters>> = {
      tokenId: tokenId.toString(),
      sourceAccountId: executorAccountId.toString(),
      transfers: [
        {
          accountId: spenderAccountId.toString(),
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
      spenderAccountId.toString(),
    );

    expect(spenderBalance.balance).toBe(50);
  });

  it.skip('should allow spender to transfer tokens to themselves and receiver using allowance', async () => {
    const context = {};
    const tool = transferFungibleTokenWithAllowanceTool(context);

    const params: z.infer<ReturnType<typeof transferFungibleTokenWithAllowanceParameters>> = {
      tokenId: tokenId.toString(),
      sourceAccountId: executorAccountId.toString(),
      transfers: [
        { accountId: spenderAccountId.toString(), amount: 30 },
        { accountId: receiverAccountId.toString(), amount: 70 },
      ],
    };

    const result: any = await tool.execute(spenderClient, context, params);

    expect(result.humanMessage).toContain(
      'Fungible tokens successfully transferred with allowance',
    );
    expect(result.raw.status).toBe('SUCCESS');

    await wait(MIRROR_NODE_WAITING_TIME);

    // FIXME: the <xyz>Wrapper.getAccountTokenBalance() calls are failing with INVALID_ACCOUNT_ID and tx id 0.0.0@...
    // using mirrornode instead is a workaround
    const spenderBalance = await spenderWrapper.getAccountTokenBalanceFromMirrornode(
      spenderAccountId.toString(),
      tokenId.toString(),
    );
    const receiverBalance = await receiverWrapper.getAccountTokenBalanceFromMirrornode(
      receiverAccountId.toString(),
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
      sourceAccountId: executorAccountId.toString(),
      transfers: [
        { accountId: spenderAccountId.toString(), amount: 30 },
        { accountId: receiverAccountId.toString(), amount: 70 },
      ],
      schedulingParams: {
        isScheduled: true,
        waitForExpiry: false,
        adminKey: false,
      },
    };

    await wait(MIRROR_NODE_WAITING_TIME);
    const result: any = await tool.execute(spenderClient, context, params);

    expect(result.humanMessage).toContain('Scheduled allowance transfer created successfully.');
    expect(result.raw.status).toBe('SUCCESS');
  });

  it('should fail gracefully when trying to transfer more than allowance', async () => {
    const context = {};
    const tool = transferFungibleTokenWithAllowanceTool(context);

    const params: z.infer<ReturnType<typeof transferFungibleTokenWithAllowanceParameters>> = {
      tokenId: tokenId.toString(),
      sourceAccountId: executorAccountId.toString(),
      transfers: [{ accountId: spenderAccountId.toString(), amount: 300 }],
    };

    const result: any = await tool.execute(spenderClient, context, params);

    expect(result.humanMessage).toContain('Failed to transfer fungible token with allowance');
    expect(result.humanMessage).toContain('AMOUNT_EXCEEDS_ALLOWANCE');
  });
});
