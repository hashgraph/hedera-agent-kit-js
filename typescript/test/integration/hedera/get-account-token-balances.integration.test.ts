import { describe, it, expect, afterAll, beforeAll, beforeEach } from 'vitest';
import { AccountId, Client, PrivateKey, TokenSupplyType } from '@hashgraph/sdk';
import { getOperatorClientForTests, getCustomClient, HederaOperationsWrapper } from '../../utils';
import { AgentMode, Context } from '@/shared';
import { getMirrornodeService } from '@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils';
import { wait } from '../../utils/general-util';
import { getAccountTokenBalancesQuery } from '@/plugins/core-account-query-plugin/tools/queries/get-account-token-balances-query';
import { MIRROR_NODE_WAITING_TIME } from '../../utils/test-constants';

describe('Integration - Hedera getTransactionRecord', () => {
  let operatorClient: Client;
  let executorClient: Client;
  let context: Context;
  let operatorAccountId: AccountId;
  let executorAccountId: AccountId;
  let targetAccountId: AccountId;
  let operatorWrapper: HederaOperationsWrapper;
  let executorWrapper: HederaOperationsWrapper;

  beforeAll(async () => {
    operatorClient = getOperatorClientForTests();
    operatorWrapper = new HederaOperationsWrapper(operatorClient);
    operatorAccountId = operatorClient.operatorAccountId!;

    const executorAccountKey = PrivateKey.generateED25519();
    executorAccountId = await operatorWrapper
      .createAccount({
        initialBalance: 50,
        key: executorAccountKey.publicKey,
      })
      .then(resp => resp.accountId!);
    executorClient = getCustomClient(executorAccountId, executorAccountKey);
    executorWrapper = new HederaOperationsWrapper(executorClient);

    context = {
      mode: AgentMode.AUTONOMOUS,
      accountId: executorAccountId.toString(),
    };
  });

  afterAll(async () => {
    if (executorClient) {
      // Transfer remaining balance back to operator and delete an executor account
      try {
        await executorWrapper.deleteAccount({
          accountId: executorAccountId,
          transferAccountId: operatorAccountId,
        });
      } catch (error) {
        console.warn('Failed to clean up executor account:', error);
      }
      executorClient.close();
    }
    if (operatorClient) {
      operatorClient.close();
    }
  });

  beforeEach(async () => {
    targetAccountId = await executorWrapper
      .createAccount({
        initialBalance: 0.001,
        key: executorClient.operatorPublicKey!,
        maxAutomaticTokenAssociations: -1, // unlimited associations
      })
      .then(resp => resp.accountId!);
  });

  it('fetches balances of account specified in the request', async () => {
    const mirrornodeService = getMirrornodeService(undefined, operatorClient.ledgerId!);
    context = {
      accountId: executorAccountId.toString(),
      mirrornodeService: mirrornodeService,
    };

    const tokenId = await executorWrapper
      .createFungibleToken({
        tokenName: 'Test',
        tokenSymbol: 'TST',
        tokenMemo: 'Test Token',
        initialSupply: 1000,
        decimals: 2,
        treasuryAccountId: executorAccountId.toString(),
        supplyType: TokenSupplyType.Infinite,
        adminKey: executorClient.operatorPublicKey!,
      })
      .then(resp => resp.tokenId!);

    await executorWrapper.transferFungible({
      amount: 100,
      to: targetAccountId.toString(),
      from: executorAccountId.toString(),
      tokenId: tokenId.toString(),
    });

    await wait(MIRROR_NODE_WAITING_TIME); // waiting for the transactions to be indexed by mirrornode

    const result = await getAccountTokenBalancesQuery(operatorClient, context, {
      accountId: targetAccountId.toString(),
      tokenId: tokenId.toString(),
    });

    expect(result.raw.tokenBalances).toMatchObject({
      tokens: [{ balance: 100, decimals: 2, token_id: tokenId.toString() }],
    });
    expect(result.humanMessage).toContain('Token Balances');
    expect(result.humanMessage).toContain(`Token: ${tokenId.toString()}`);
    expect(result.humanMessage).toContain(`Balance: 100`);
    expect(result.humanMessage).toContain(`Decimals: 2`);
  });

  it('defaults to executor account if no account is passed', async () => {
    const mirrornodeService = getMirrornodeService(undefined, operatorClient.ledgerId!);
    context = {
      accountId: executorAccountId.toString(),
      mirrornodeService: mirrornodeService,
    };

    const tokenId = await executorWrapper
      .createFungibleToken({
        tokenName: 'Default Test',
        tokenSymbol: 'DFT',
        tokenMemo: 'Default Test Token',
        initialSupply: 500,
        decimals: 3,
        treasuryAccountId: executorAccountId.toString(),
        supplyType: TokenSupplyType.Infinite,
        adminKey: executorClient.operatorPublicKey!,
      })
      .then(resp => resp.tokenId!);

    await wait(MIRROR_NODE_WAITING_TIME); // waiting for the transactions to be indexed by mirrornode

    const result = await getAccountTokenBalancesQuery(executorClient, context, {
      tokenId: tokenId.toString(),
    });

    expect(result.raw.tokenBalances).toMatchObject({
      tokens: [{ balance: 500, decimals: 3, token_id: tokenId.toString() }],
    });
    expect(result.humanMessage).toContain('Token Balances');
    expect(result.humanMessage).toContain(executorAccountId.toString());
    expect(result.humanMessage).toContain(`Token: ${tokenId.toString()}`);
    expect(result.humanMessage).toContain(`Balance: 500`);
    expect(result.humanMessage).toContain(`Decimals: 3`);
  });

  it('fetches balances of multiple assets for account specified in the request', async () => {
    const mirrornodeService = getMirrornodeService(undefined, operatorClient.ledgerId!);
    context = {
      accountId: executorAccountId.toString(),
      mirrornodeService: mirrornodeService,
    };

    // Create two different tokens
    const tokenId1 = await executorWrapper
      .createFungibleToken({
        tokenName: 'Multi Test 1',
        tokenSymbol: 'MT1',
        tokenMemo: 'Multi Test Token 1',
        initialSupply: 1000,
        decimals: 2,
        treasuryAccountId: executorAccountId.toString(),
        supplyType: TokenSupplyType.Infinite,
        adminKey: executorClient.operatorPublicKey!,
      })
      .then(resp => resp.tokenId!);

    const tokenId2 = await executorWrapper
      .createFungibleToken({
        tokenName: 'Multi Test 2',
        tokenSymbol: 'MT2',
        tokenMemo: 'Multi Test Token 2',
        initialSupply: 2000,
        decimals: 1,
        treasuryAccountId: executorAccountId.toString(),
        supplyType: TokenSupplyType.Infinite,
        adminKey: executorClient.operatorPublicKey!,
      })
      .then(resp => resp.tokenId!);

    // Transfer both tokens to a target account
    await executorWrapper.transferFungible({
      amount: 150,
      to: targetAccountId.toString(),
      from: executorAccountId.toString(),
      tokenId: tokenId1.toString(),
    });

    await executorWrapper.transferFungible({
      amount: 250,
      to: targetAccountId.toString(),
      from: executorAccountId.toString(),
      tokenId: tokenId2.toString(),
    });

    await wait(MIRROR_NODE_WAITING_TIME); // waiting for the transactions to be indexed by mirrornode

    const result = await getAccountTokenBalancesQuery(operatorClient, context, {
      accountId: targetAccountId.toString(),
    });

    expect(result.raw.tokenBalances?.tokens).toHaveLength(2);
    expect(result.raw.tokenBalances?.tokens).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          balance: 150,
          decimals: 2,
          token_id: tokenId1.toString(),
        }),
        expect.objectContaining({
          balance: 250,
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
      accountId: executorAccountId.toString(),
      mirrornodeService,
    };

    const nonExistentAccountId = '0.0.999999999';

    const resp = await getAccountTokenBalancesQuery(operatorClient, context, {
      accountId: nonExistentAccountId,
    });

    expect(resp.humanMessage).toContain('Not Found');
    expect(resp.humanMessage).toContain('Failed to get account token balances');
    expect(resp.raw.error).toContain('Failed to get account token balances');
  });

  it('handles account with no token associations', async () => {
    const mirrornodeService = getMirrornodeService(undefined, operatorClient.ledgerId!);
    context = {
      accountId: executorAccountId.toString(),
      mirrornodeService: mirrornodeService,
    };

    // Create an account with no token associations
    const emptyAccountId = await executorWrapper
      .createAccount({
        initialBalance: 1,
        key: executorClient.operatorPublicKey!,
        maxAutomaticTokenAssociations: 0, // no automatic associations
      })
      .then(resp => resp.accountId!);

    await wait(MIRROR_NODE_WAITING_TIME); // waiting for an account to be indexed by mirrornode

    const result = await getAccountTokenBalancesQuery(operatorClient, context, {
      accountId: emptyAccountId.toString(),
    });

    expect(result.raw.tokenBalances?.tokens).toEqual([]);
    expect(result.humanMessage).toContain('No token balances found');

    // Cleanup
    try {
      await executorWrapper.deleteAccount({
        accountId: emptyAccountId,
        transferAccountId: executorAccountId,
      });
    } catch (error) {
      console.warn('Failed to clean up empty account:', error);
    }
  });

  it('filters results by specific token ID', async () => {
    const mirrornodeService = getMirrornodeService(undefined, operatorClient.ledgerId!);
    context = {
      accountId: executorAccountId.toString(),
      mirrornodeService: mirrornodeService,
    };

    // Create two tokens
    const tokenId1 = await executorWrapper
      .createFungibleToken({
        tokenName: 'Filter Test 1',
        tokenSymbol: 'FT1',
        tokenMemo: 'Filter Test Token 1',
        initialSupply: 1000,
        decimals: 2,
        treasuryAccountId: executorAccountId.toString(),
        supplyType: TokenSupplyType.Infinite,
        adminKey: executorClient.operatorPublicKey!,
      })
      .then(resp => resp.tokenId!);

    const tokenId2 = await executorWrapper
      .createFungibleToken({
        tokenName: 'Filter Test 2',
        tokenSymbol: 'FT2',
        tokenMemo: 'Filter Test Token 2',
        initialSupply: 2000,
        decimals: 1,
        treasuryAccountId: executorAccountId.toString(),
        supplyType: TokenSupplyType.Infinite,
        adminKey: executorClient.operatorPublicKey!,
      })
      .then(resp => resp.tokenId!);

    // Transfer both tokens to a target account
    await executorWrapper.transferFungible({
      amount: 100,
      to: targetAccountId.toString(),
      from: executorAccountId.toString(),
      tokenId: tokenId1.toString(),
    });

    await executorWrapper.transferFungible({
      amount: 200,
      to: targetAccountId.toString(),
      from: executorAccountId.toString(),
      tokenId: tokenId2.toString(),
    });

    await wait(MIRROR_NODE_WAITING_TIME); // waiting for the transactions to be indexed by mirrornode

    // Query for only the first token
    const result = await getAccountTokenBalancesQuery(operatorClient, context, {
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
      accountId: executorAccountId.toString(),
      mirrornodeService,
    };

    const resp = await getAccountTokenBalancesQuery(operatorClient, context, {
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
      accountId: executorAccountId.toString(),
      mirrornodeService: mirrornodeService,
    };

    const tokenId = await executorWrapper
      .createFungibleToken({
        tokenName: 'Zero Balance Test',
        tokenSymbol: 'ZBT',
        tokenMemo: 'Zero Balance Test Token',
        initialSupply: 1000,
        decimals: 2,
        treasuryAccountId: executorAccountId.toString(),
        supplyType: TokenSupplyType.Infinite,
        adminKey: executorClient.operatorPublicKey!,
      })
      .then(resp => resp.tokenId!);

    // Associate the token with a target account but don't transfer any
    await executorWrapper.associateToken({
      accountId: targetAccountId.toString(),
      tokenId: tokenId.toString(),
    });

    await wait(MIRROR_NODE_WAITING_TIME); // waiting for the transactions to be indexed by mirrornode

    const result = await getAccountTokenBalancesQuery(operatorClient, context, {
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
