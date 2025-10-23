import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client, PrivateKey, AccountId, TokenSupplyType, PublicKey } from '@hashgraph/sdk';
import { AgentExecutor } from 'langchain/agents';
import {
  createLangchainTestSetup,
  getCustomClient,
  getOperatorClientForTests,
  HederaOperationsWrapper,
  type LangchainTestSetup,
} from '../utils';
import { extractObservationFromLangchainResponse, wait } from '../utils/general-util';
import { returnHbarsAndDeleteAccount } from '../utils/teardown/account-teardown';
import { MIRROR_NODE_WAITING_TIME } from '../utils/test-constants';
import { itWithRetry } from '../utils/retry-util';

describe('Associate Token E2E Tests', () => {
  let operatorClient: Client;
  let executorClient: Client;
  let tokenExecutorClient: Client;
  let tokenExecutorAccountId: AccountId;
  let operatorWrapper: HederaOperationsWrapper;
  let tokenExecutorWrapper: HederaOperationsWrapper;
  let executorAccountId: AccountId;
  let executorWrapper: HederaOperationsWrapper;
  let testSetup: LangchainTestSetup;
  let agentExecutor: AgentExecutor;

  const FT_PARAMS = {
    tokenName: 'AssocToken',
    tokenSymbol: 'ASSOC',
    tokenMemo: 'FT',
    initialSupply: 0,
    decimals: 0,
    maxSupply: 1000,
    supplyType: TokenSupplyType.Finite,
  };

  beforeAll(async () => {
    operatorClient = getOperatorClientForTests();
    operatorWrapper = new HederaOperationsWrapper(operatorClient);

    const executorKey = PrivateKey.generateED25519();
    executorAccountId = await operatorWrapper
      .createAccount({ key: executorKey.publicKey, initialBalance: 50 })
      .then(resp => resp.accountId!);

    executorClient = getCustomClient(executorAccountId, executorKey);
    executorWrapper = new HederaOperationsWrapper(executorClient);

    const tokenExecutorKey = PrivateKey.generateED25519();
    tokenExecutorAccountId = await operatorWrapper
      .createAccount({ key: tokenExecutorKey.publicKey, initialBalance: 50 })
      .then(resp => resp.accountId!);

    tokenExecutorClient = getCustomClient(tokenExecutorAccountId, tokenExecutorKey);
    tokenExecutorWrapper = new HederaOperationsWrapper(tokenExecutorClient);

    testSetup = await createLangchainTestSetup(undefined, undefined, executorClient);
    agentExecutor = testSetup.agentExecutor;
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

  it(
    'should associate token successfully via agent',
    itWithRetry(async () => {
      const tokenIdFT1 = await tokenExecutorWrapper
        .createFungibleToken({
          ...FT_PARAMS,
          supplyKey: tokenExecutorClient.operatorPublicKey! as PublicKey,
          adminKey: tokenExecutorClient.operatorPublicKey! as PublicKey,
          treasuryAccountId: tokenExecutorAccountId.toString(),
          autoRenewAccountId: tokenExecutorAccountId.toString(),
        })
        .then(resp => resp.tokenId!);

      await wait(MIRROR_NODE_WAITING_TIME);
      const queryResult = await agentExecutor.invoke({
        input: `Associate token ${tokenIdFT1.toString()} to my account`,
      });

      const observation = extractObservationFromLangchainResponse(queryResult);
      await wait(MIRROR_NODE_WAITING_TIME);

      const balances = await executorWrapper.getAccountBalances(executorAccountId.toString());
      const associated = (balances.tokens?.get(tokenIdFT1) ?? 0) >= 0; // presence implies associated

      expect(observation.humanMessage).toContain('Tokens successfully associated');
      expect(observation.raw.status).toBe('SUCCESS');
      expect(associated).toBe(true);
    }),
  );

  it(
    'should associate two tokens successfully via agent',
    itWithRetry(async () => {
      const tokenIdFT1 = await tokenExecutorWrapper
        .createFungibleToken({
          ...FT_PARAMS,
          supplyKey: tokenExecutorClient.operatorPublicKey! as PublicKey,
          adminKey: tokenExecutorClient.operatorPublicKey! as PublicKey,
          treasuryAccountId: tokenExecutorAccountId.toString(),
          autoRenewAccountId: tokenExecutorAccountId.toString(),
        })
        .then(resp => resp.tokenId!);
      // Create an extra token
      const tokenIdFT2 = await tokenExecutorWrapper
        .createFungibleToken({
          tokenName: 'AssocToken2',
          tokenSymbol: 'ASSOC2',
          tokenMemo: 'FT2',
          initialSupply: 0,
          decimals: 0,
          maxSupply: 1000,
          supplyType: TokenSupplyType.Finite,
          supplyKey: tokenExecutorClient.operatorPublicKey! as PublicKey,
          adminKey: tokenExecutorClient.operatorPublicKey! as PublicKey,
          treasuryAccountId: tokenExecutorAccountId.toString(),
          autoRenewAccountId: tokenExecutorAccountId.toString(),
        })
        .then(resp => resp.tokenId!);

      await wait(MIRROR_NODE_WAITING_TIME);

      const queryResult = await agentExecutor.invoke({
        input: `Associate tokens ${tokenIdFT1.toString()} and ${tokenIdFT2.toString()} to my account`,
      });

      const observation = extractObservationFromLangchainResponse(queryResult);
      await wait(MIRROR_NODE_WAITING_TIME);

      const balances = await executorWrapper.getAccountBalances(executorAccountId.toString());
      const associatedFirst = (balances.tokens?.get(tokenIdFT1) ?? 0) >= 0;
      const associatedSecond = (balances.tokens?.get(tokenIdFT2) ?? 0) >= 0;

      expect(observation.humanMessage).toContain('Tokens successfully associated');
      expect(observation.raw.status).toBe('SUCCESS');
      expect(associatedFirst).toBe(true);
      expect(associatedSecond).toBe(true);
    }),
  );
});
