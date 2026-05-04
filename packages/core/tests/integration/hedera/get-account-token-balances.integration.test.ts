import { describe, it, expect, afterAll, beforeAll, beforeEach } from 'vitest';
import { AccountId, Client, TokenSupplyType } from '@hiero-ledger/sdk';
import {
  getProfile,
  HederaOperationsWrapper,
  type TestAccount,
} from '@hashgraph/hedera-agent-kit-tests';
import { AgentMode, type Context } from '@/shared/configuration';
import { getMirrornodeService } from '@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils';
import { waitForMirrorTx } from '@hashgraph/hedera-agent-kit-tests';
import { GetAccountTokenBalancesQueryTool } from '@/plugins/core-account-query-plugin/tools/queries/get-account-token-balances-query';

describe('Integration - Hedera getTransactionRecord', () => {
  const profile = getProfile();
  let operatorClient: Client;
  let executor: TestAccount;
  let executorClient: Client;
  let executorWrapper: HederaOperationsWrapper;
  let context: Context;
  let targetAccountId: AccountId;

  beforeAll(async () => {
    ({ client: operatorClient } = profile.client.connectAs(profile.operator));

    executor = await profile.accounts.acquire({ tier: 'ELEVATED' });
    ({ client: executorClient, wrapper: executorWrapper } = profile.client.connectAs(executor));

    context = {
      mode: AgentMode.AUTONOMOUS,
      accountId: executor.accountId.toString(),
    };
  });

  afterAll(async () => {
    await profile.accounts.release(executor);
    executorClient?.close();
    operatorClient?.close();
  });

  beforeEach(async () => {
    targetAccountId = await executorWrapper
      .createAccount({
        initialBalance: profile.balance.usdToHbar(0.1),
        key: executor.privateKey.publicKey,
        maxAutomaticTokenAssociations: -1, // unlimited associations
      })
      .then(resp => resp.accountId!);
  });

  it('fetches balances of account specified in the request', async () => {
    const mirrornodeService = getMirrornodeService(undefined, operatorClient.ledgerId!);
    context = {
      accountId: executor.accountId.toString(),
      mirrornodeService: mirrornodeService,
    };

    const tokenId = await executorWrapper
      .createFungibleToken({
        tokenName: 'Test',
        tokenSymbol: 'TST',
        tokenMemo: 'Test Token',
        initialSupply: 1000,
        decimals: 2,
        treasuryAccountId: executor.accountId.toString(),
        supplyType: TokenSupplyType.Infinite,
        adminKey: executor.privateKey.publicKey,
      })
      .then(resp => resp.tokenId!);

    const transferResp = await executorWrapper.transferFungible({
      amount: 100, // given in base units. Equals 1 in display units
      to: targetAccountId.toString(),
      from: executor.accountId.toString(),
      tokenId: tokenId.toString(),
    });

    await waitForMirrorTx(executorWrapper, transferResp.transactionId!); // waiting for the transactions to be indexed by mirrornode

    const tool = new GetAccountTokenBalancesQueryTool(context);
    const result = await tool.execute(operatorClient, context, {
      accountId: targetAccountId.toString(),
      tokenId: tokenId.toString(),
    });

    expect(result.raw.tokenBalances).toMatchObject({
      tokens: [{ balance: 100, decimals: 2, token_id: tokenId.toString() }],
    });
    expect(result.humanMessage).toContain('Token Balances');
    expect(result.humanMessage).toContain(`Token: ${tokenId.toString()}`);
    expect(result.humanMessage).toContain(`Balance: 1`);
    expect(result.humanMessage).toContain(`Decimals: 2`);
  });

  it('defaults to executor account if no account is passed', async () => {
    const mirrornodeService = getMirrornodeService(undefined, operatorClient.ledgerId!);
    context = {
      accountId: executor.accountId.toString(),
      mirrornodeService: mirrornodeService,
    };

    const createTokenResp = await executorWrapper.createFungibleToken({
      tokenName: 'Default Test',
      tokenSymbol: 'DFT',
      tokenMemo: 'Default Test Token',
      initialSupply: 500, // given in base units. Equals 0.5 in display units
      decimals: 3,
      treasuryAccountId: executor.accountId.toString(),
      supplyType: TokenSupplyType.Infinite,
      adminKey: executor.privateKey.publicKey,
    });
    const tokenId = createTokenResp.tokenId!;

    await waitForMirrorTx(executorWrapper, createTokenResp.transactionId!); // waiting for the transactions to be indexed by mirrornode

    const tool = new GetAccountTokenBalancesQueryTool(context);
    const result = await tool.execute(executorClient, context, {
      tokenId: tokenId.toString(),
    });

    expect(result.raw.tokenBalances).toMatchObject({
      tokens: [{ balance: 500, decimals: 3, token_id: tokenId.toString() }], // the object contains the balance in base units
    });
    expect(result.humanMessage).toContain('Token Balances');
    expect(result.humanMessage).toContain(executor.accountId.toString());
    expect(result.humanMessage).toContain(`Token: ${tokenId.toString()}`);
    expect(result.humanMessage).toContain(`Balance: 0.5`);
    expect(result.humanMessage).toContain(`Decimals: 3`);
  });

  it('fetches balances of multiple assets for account specified in the request', async () => {
    const mirrornodeService = getMirrornodeService(undefined, operatorClient.ledgerId!);
    context = {
      accountId: executor.accountId.toString(),
      mirrornodeService: mirrornodeService,
    };

    // Create two different tokens
    const tokenId1 = await executorWrapper
      .createFungibleToken({
        tokenName: 'Multi Test 1',
        tokenSymbol: 'MT1',
        tokenMemo: 'Multi Test Token 1',
        initialSupply: 1000, // given in base units. Equals 10.0 in display units
        decimals: 2,
        treasuryAccountId: executor.accountId.toString(),
        supplyType: TokenSupplyType.Infinite,
        adminKey: executor.privateKey.publicKey,
      })
      .then(resp => resp.tokenId!);

    const tokenId2 = await executorWrapper
      .createFungibleToken({
        tokenName: 'Multi Test 2',
        tokenSymbol: 'MT2',
        tokenMemo: 'Multi Test Token 2',
        initialSupply: 2000, // given in base units. Equals 200.0 in display units
        decimals: 1,
        treasuryAccountId: executor.accountId.toString(),
        supplyType: TokenSupplyType.Infinite,
        adminKey: executor.privateKey.publicKey,
      })
      .then(resp => resp.tokenId!);

    // Transfer both tokens to a target account
    await executorWrapper.transferFungible({
      amount: 150, // given in base units. Equals 15.0 in display units
      to: targetAccountId.toString(),
      from: executor.accountId.toString(),
      tokenId: tokenId1.toString(),
    });

    const transfer2Resp = await executorWrapper.transferFungible({
      amount: 250,
      to: targetAccountId.toString(),
      from: executor.accountId.toString(),
      tokenId: tokenId2.toString(),
    });

    await waitForMirrorTx(executorWrapper, transfer2Resp.transactionId!); // waiting for the transactions to be indexed by mirrornode

    const tool = new GetAccountTokenBalancesQueryTool(context);
    const result = await tool.execute(operatorClient, context, {
      accountId: targetAccountId.toString(),
    });

    expect(result.raw.tokenBalances?.tokens).toHaveLength(2);
    expect(result.raw.tokenBalances?.tokens).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          balance: 150, // the object contains the balance in base units
          decimals: 2,
          token_id: tokenId1.toString(),
        }),
        expect.objectContaining({
          balance: 250, // the object contains the balance in base units
          decimals: 1,
          token_id: tokenId2.toString(),
        }),
      ]),
    );
    expect(result.humanMessage).toContain('Token Balances');
    expect(result.humanMessage).toContain(tokenId1.toString());
    expect(result.humanMessage).toContain(tokenId2.toString());
  });

  it('throws an error for non-existent account', async () => {
    const mirrornodeService = getMirrornodeService(undefined, operatorClient.ledgerId!);
    context = {
      accountId: executor.accountId.toString(),
      mirrornodeService,
    };

    const nonExistentAccountId = '0.0.999999999';

    const tool = new GetAccountTokenBalancesQueryTool(context);
    const resp = await tool.execute(operatorClient, context, {
      accountId: nonExistentAccountId,
    });

    expect(resp.humanMessage).toContain('Not Found');
    expect(resp.humanMessage).toContain('Failed to get account token balances');
    expect(resp.raw.error).toContain('Failed to get account token balances');
  });

  it('handles account with no token associations', async () => {
    const mirrornodeService = getMirrornodeService(undefined, operatorClient.ledgerId!);
    context = {
      accountId: executor.accountId.toString(),
      mirrornodeService: mirrornodeService,
    };

    // Create an account with no token associations
    const emptyAcctResp = await executorWrapper.createAccount({
      initialBalance: 1,
      key: executor.privateKey.publicKey,
      maxAutomaticTokenAssociations: 0, // no automatic associations
    });
    const emptyAccountId = emptyAcctResp.accountId!;

    await waitForMirrorTx(executorWrapper, emptyAcctResp.transactionId!); // waiting for an account to be indexed by mirrornode

    const tool = new GetAccountTokenBalancesQueryTool(context);
    const result = await tool.execute(operatorClient, context, {
      accountId: emptyAccountId.toString(),
    });

    expect(result.raw.tokenBalances?.tokens).toEqual([]);
    expect(result.humanMessage).toContain('No token balances found');

    // Cleanup
    try {
      await executorWrapper.deleteAccount({
        accountId: emptyAccountId,
        transferAccountId: executor.accountId,
      });
    } catch (error) {
      console.warn('Failed to clean up empty account:', error);
    }
  });

  it('filters results by specific token ID', async () => {
    const mirrornodeService = getMirrornodeService(undefined, operatorClient.ledgerId!);
    context = {
      accountId: executor.accountId.toString(),
      mirrornodeService: mirrornodeService,
    };

    // Create two tokens
    const tokenId1 = await executorWrapper
      .createFungibleToken({
        tokenName: 'Filter Test 1',
        tokenSymbol: 'FT1',
        tokenMemo: 'Filter Test Token 1',
        initialSupply: 1000, // given in base units. Equals 10.00 in display units
        decimals: 2,
        treasuryAccountId: executor.accountId.toString(),
        supplyType: TokenSupplyType.Infinite,
        adminKey: executor.privateKey.publicKey,
      })
      .then(resp => resp.tokenId!);

    const tokenId2 = await executorWrapper
      .createFungibleToken({
        tokenName: 'Filter Test 2',
        tokenSymbol: 'FT2',
        tokenMemo: 'Filter Test Token 2',
        initialSupply: 2000, // given in base units. Equals 200.0 in display units
        decimals: 1,
        treasuryAccountId: executor.accountId.toString(),
        supplyType: TokenSupplyType.Infinite,
        adminKey: executor.privateKey.publicKey,
      })
      .then(resp => resp.tokenId!);

    // Transfer both tokens to a target account
    await executorWrapper.transferFungible({
      amount: 100, // given in base units. Equals 10.00 in display units
      to: targetAccountId.toString(),
      from: executor.accountId.toString(),
      tokenId: tokenId1.toString(),
    });

    const transferLastResp = await executorWrapper.transferFungible({
      amount: 200, // given in base units. Equals 2.00 in display units
      to: targetAccountId.toString(),
      from: executor.accountId.toString(),
      tokenId: tokenId2.toString(),
    });

    await waitForMirrorTx(executorWrapper, transferLastResp.transactionId!); // waiting for the transactions to be indexed by mirrornode

    // Query for only the first token
    const tool = new GetAccountTokenBalancesQueryTool(context);
    const result = await tool.execute(operatorClient, context, {
      accountId: targetAccountId.toString(),
      tokenId: tokenId1.toString(),
    });

    expect(result.raw.tokenBalances?.tokens).toHaveLength(1);
    expect(result.raw.tokenBalances?.tokens[0]).toMatchObject({
      balance: 100,
      decimals: 2,
      token_id: tokenId1.toString(),
    });
    expect(result.humanMessage).toContain('Token Balances');
    expect(result.humanMessage).toContain(tokenId1.toString());
    expect(result.humanMessage).not.toContain(tokenId2.toString());
  });

  it('handles invalid token ID format', async () => {
    const mirrornodeService = getMirrornodeService(undefined, operatorClient.ledgerId!);
    context = {
      accountId: executor.accountId.toString(),
      mirrornodeService,
    };

    const tool = new GetAccountTokenBalancesQueryTool(context);
    const resp = await tool.execute(operatorClient, context, {
      accountId: targetAccountId.toString(),
      tokenId: 'invalid-token-id',
    });

    expect(resp.humanMessage).toContain('Not Found');
    expect(resp.humanMessage).toContain('Failed to get account token balances');
    expect(resp.raw.error).toContain('Failed to get account token balances');
  });

  it('handles zero token balance correctly', async () => {
    const mirrornodeService = getMirrornodeService(undefined, operatorClient.ledgerId!);
    context = {
      accountId: executor.accountId.toString(),
      mirrornodeService: mirrornodeService,
    };

    const tokenId = await executorWrapper
      .createFungibleToken({
        tokenName: 'Zero Balance Test',
        tokenSymbol: 'ZBT',
        tokenMemo: 'Zero Balance Test Token',
        initialSupply: 1000,
        decimals: 2,
        treasuryAccountId: executor.accountId.toString(),
        supplyType: TokenSupplyType.Infinite,
        adminKey: executor.privateKey.publicKey,
      })
      .then(resp => resp.tokenId!);

    // Associate the token with a target account but don't transfer any
    const assocResp = await executorWrapper.associateToken({
      accountId: targetAccountId.toString(),
      tokenId: tokenId.toString(),
    });

    await waitForMirrorTx(executorWrapper, assocResp.transactionId!); // waiting for the transactions to be indexed by mirrornode

    const tool = new GetAccountTokenBalancesQueryTool(context);
    const result = await tool.execute(operatorClient, context, {
      accountId: targetAccountId.toString(),
      tokenId: tokenId.toString(),
    });

    expect(result.raw.tokenBalances?.tokens).toHaveLength(1);
    expect(result.raw.tokenBalances?.tokens[0]).toMatchObject({
      balance: 0,
      decimals: 2,
      token_id: tokenId.toString(),
    });
    expect(result.humanMessage).toContain('Token Balances');
    expect(result.humanMessage).toContain('Balance: 0');
  });
});
