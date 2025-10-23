import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client, PrivateKey, AccountId, PublicKey, TokenId, TokenSupplyType } from '@hashgraph/sdk';
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

describe('Get Pending Airdrop Query E2E Tests', () => {
  let operatorClient: Client;
  let executorClient: Client;
  let executorAccountId: AccountId;
  let executorWrapper: HederaOperationsWrapper;
  let tokenIdFT: TokenId;
  let testSetup: LangchainTestSetup;
  let agentExecutor: AgentExecutor;
  let recipientId: AccountId;

  const FT_PARAMS = {
    tokenName: 'AirdropE2EToken',
    tokenSymbol: 'ADE',
    tokenMemo: 'FT-PENDING-E2E',
    initialSupply: 100000,
    decimals: 2,
    maxSupply: 500000,
    supplyType: TokenSupplyType.Finite,
  };

  beforeAll(async () => {
    operatorClient = getOperatorClientForTests();
    const operatorWrapper = new HederaOperationsWrapper(operatorClient);

    const executorAccountKey = PrivateKey.generateED25519();
    executorAccountId = await operatorWrapper
      .createAccount({ key: executorAccountKey.publicKey, initialBalance: 50 })
      .then(resp => resp.accountId!);

    executorClient = getCustomClient(executorAccountId, executorAccountKey);
    testSetup = await createLangchainTestSetup(undefined, undefined, executorClient);
    agentExecutor = testSetup.agentExecutor;
    executorWrapper = new HederaOperationsWrapper(executorClient);

    tokenIdFT = await executorWrapper
      .createFungibleToken({
        ...FT_PARAMS,
        supplyKey: executorClient.operatorPublicKey! as PublicKey,
        autoRenewAccountId: executorAccountId.toString(),
        adminKey: executorClient.operatorPublicKey! as PublicKey,
        treasuryAccountId: executorAccountId.toString(),
      })
      .then(resp => resp.tokenId!);

    // Recipient with no auto-assoc to create pending airdrop
    const recipientKey = PrivateKey.generateED25519();
    recipientId = await operatorWrapper
      .createAccount({
        key: recipientKey.publicKey,
        initialBalance: 0,
        maxAutomaticTokenAssociations: 0,
      })
      .then(resp => resp.accountId!);

    await executorWrapper.airdropToken({
      tokenTransfers: [
        { tokenId: tokenIdFT.toString(), accountId: recipientId.toString(), amount: 10 },
        { tokenId: tokenIdFT.toString(), accountId: executorAccountId.toString(), amount: -10 },
      ],
    });

    await wait(MIRROR_NODE_WAITING_TIME);
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
    'should return pending airdrops for recipient via natural language',
    itWithRetry(async () => {
      const queryResult = await agentExecutor.invoke({
        input: `Show pending airdrops for account ${recipientId.toString()}`,
      });

      const observation = extractObservationFromLangchainResponse(queryResult);

      expect(observation.humanMessage).toContain(
        `pending airdrops for account **${recipientId.toString()}**`,
      );
      expect(Array.isArray(observation.raw.pendingAirdrops.airdrops)).toBe(true);
      expect(observation.raw.pendingAirdrops.airdrops.length).toBeGreaterThan(0);
    }),
  );
});
