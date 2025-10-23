import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AccountId, Client, PrivateKey, TokenId, TokenSupplyType } from '@hashgraph/sdk';
import { AgentExecutor } from 'langchain/agents';
import {
  createLangchainTestSetup,
  getCustomClient,
  getOperatorClientForTests,
  HederaOperationsWrapper,
  type LangchainTestSetup,
} from '../utils';
import { extractObservationFromLangchainResponse } from '../utils/general-util';
import { returnHbarsAndDeleteAccount } from '../utils/teardown/account-teardown';
import { itWithRetry } from '../utils/retry-util';

describe('Airdrop Fungible Token E2E Tests', () => {
  let operatorClient: Client;
  let executorClient: Client;
  let tokenCreatorClient: Client;
  let executorAccountId: AccountId;
  let tokenCreatorAccountId: AccountId;
  let executorWrapper: HederaOperationsWrapper;
  let tokenCreatorWrapper: HederaOperationsWrapper;
  let tokenIdFT: TokenId;
  let tokenIdFT2: TokenId;
  let testSetup: LangchainTestSetup;
  let agentExecutor: AgentExecutor;

  const FT_PARAMS = {
    tokenName: 'AirdropToken',
    tokenSymbol: 'DROP',
    tokenMemo: 'FT-AIRDROP',
    initialSupply: 100000,
    decimals: 2,
    maxSupply: 500000,
    supplyType: TokenSupplyType.Finite,
  };

  beforeAll(async () => {
    operatorClient = getOperatorClientForTests();
    const operatorWrapper = new HederaOperationsWrapper(operatorClient);

    // Executor account
    const executorKey = PrivateKey.generateED25519();
    executorAccountId = await operatorWrapper
      .createAccount({
        key: executorKey.publicKey,
        initialBalance: 50,
        maxAutomaticTokenAssociations: -1,
      })
      .then(resp => resp.accountId!);

    executorClient = getCustomClient(executorAccountId, executorKey);
    executorWrapper = new HederaOperationsWrapper(executorClient);

    // Token creator account
    const tokenCreatorKey = PrivateKey.generateED25519();
    tokenCreatorAccountId = await operatorWrapper
      .createAccount({ key: tokenCreatorKey.publicKey, initialBalance: 50 })
      .then(resp => resp.accountId!);

    tokenCreatorClient = getCustomClient(tokenCreatorAccountId, tokenCreatorKey);
    tokenCreatorWrapper = new HederaOperationsWrapper(tokenCreatorClient);

    // Setup agent
    testSetup = await createLangchainTestSetup(undefined, undefined, executorClient);
    agentExecutor = testSetup.agentExecutor;

    // Deploy fungible tokens
    tokenIdFT = await tokenCreatorWrapper
      .createFungibleToken({
        ...FT_PARAMS,
        supplyKey: tokenCreatorKey.publicKey,
        adminKey: tokenCreatorKey.publicKey,
        treasuryAccountId: tokenCreatorAccountId.toString(),
      })
      .then(resp => resp.tokenId!);

    tokenIdFT2 = await tokenCreatorWrapper
      .createFungibleToken({
        ...FT_PARAMS,
        supplyKey: tokenCreatorKey.publicKey,
        adminKey: tokenCreatorKey.publicKey,
        treasuryAccountId: tokenCreatorAccountId.toString(),
      })
      .then(resp => resp.tokenId!);
  });

  afterAll(async () => {
    // Delete executor and token creator accounts
    if (executorClient && operatorClient) {
      await returnHbarsAndDeleteAccount(
        executorWrapper,
        executorAccountId,
        operatorClient.operatorAccountId!,
      );
      await returnHbarsAndDeleteAccount(
        tokenCreatorWrapper,
        tokenCreatorAccountId,
        operatorClient.operatorAccountId!,
      );
      executorClient.close();
      operatorClient.close();
      tokenCreatorClient.close();
    }
  });

  it(
    'should dissociate the executor account from the given token',
    itWithRetry(async () => {
      await executorWrapper.associateToken({
        accountId: executorAccountId.toString(),
        tokenId: tokenIdFT.toString(),
      });
      const tokenBalancesBefore = await executorWrapper.getAccountTokenBalances(
        executorAccountId.toString(),
      );
      expect(tokenBalancesBefore.find(t => t.tokenId === tokenIdFT.toString())).toBeTruthy();

      const queryResult = await agentExecutor.invoke({
        input: `Dissociate ${tokenIdFT.toString()} from my account`,
      });

      const observation = extractObservationFromLangchainResponse(queryResult);

      expect(observation.humanMessage).toContain('successfully dissociated');
      expect(observation.raw.status).toBe('SUCCESS');

      const tokenBalancesAfter = await executorWrapper.getAccountTokenBalances(
        executorAccountId.toString(),
      );
      expect(tokenBalancesAfter.find(t => t.tokenId === tokenIdFT.toString())).toBeFalsy();
    }),
  );

  it(
    'should dissociate 2 tokens at once',
    itWithRetry(async () => {
      await executorWrapper.associateToken({
        accountId: executorAccountId.toString(),
        tokenId: tokenIdFT.toString(),
      });
      await executorWrapper.associateToken({
        accountId: executorAccountId.toString(),
        tokenId: tokenIdFT2.toString(),
      });

      const tokenBalancesBefore = await executorWrapper.getAccountTokenBalances(
        executorAccountId.toString(),
      );
      expect(tokenBalancesBefore.find(t => t.tokenId === tokenIdFT.toString())).toBeTruthy();
      expect(tokenBalancesBefore.find(t => t.tokenId === tokenIdFT2.toString())).toBeTruthy();

      const queryResult = await agentExecutor.invoke({
        input: `Dissociate tokens ${tokenIdFT.toString()} and ${tokenIdFT2.toString()} from my account`,
      });

      const observation = extractObservationFromLangchainResponse(queryResult);

      expect(observation.humanMessage).toContain('successfully dissociated');
      expect(observation.raw.status).toBe('SUCCESS');

      const tokenBalancesAfter = await executorWrapper.getAccountTokenBalances(
        executorAccountId.toString(),
      );
      expect(tokenBalancesAfter.find(t => t.tokenId === tokenIdFT.toString())).toBeFalsy();
      expect(tokenBalancesAfter.find(t => t.tokenId === tokenIdFT2.toString())).toBeFalsy();
    }),
  );

  it(
    'should fail dissociating not associated token',
    itWithRetry(async () => {
      // check if the account is not associate with the token
      const tokenBalancesBefore = await executorWrapper.getAccountTokenBalances(
        executorAccountId.toString(),
      );
      expect(tokenBalancesBefore.find(t => t.tokenId === tokenIdFT.toString())).toBeFalsy();

      const queryResult = await agentExecutor.invoke({
        input: `Dissociate ${tokenIdFT.toString()} from my account`,
      });

      const observation = extractObservationFromLangchainResponse(queryResult);

      expect(observation.humanMessage).toContain('Failed to dissociate');
      expect(observation.raw.status).not.toBe('SUCCESS');
    }),
  );

  it(
    'should fail dissociating not existing token',
    itWithRetry(async () => {
      const queryResult = await agentExecutor.invoke({
        input: `Dissociate token 0.0.22223333444 from my account`,
      });

      const observation = extractObservationFromLangchainResponse(queryResult);

      expect(observation.humanMessage).toContain('Failed to dissociate');
      expect(observation.raw.status).not.toBe('SUCCESS');
    }),
  );
});
