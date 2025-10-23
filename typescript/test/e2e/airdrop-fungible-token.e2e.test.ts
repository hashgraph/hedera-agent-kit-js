import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AccountId, Client, PrivateKey, PublicKey, TokenId, TokenSupplyType } from '@hashgraph/sdk';
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

describe('Airdrop Fungible Token E2E Tests', () => {
  let operatorClient: Client;
  let executorClient: Client;
  let executorAccountId: AccountId;
  let executorWrapper: HederaOperationsWrapper;
  let tokenIdFT: TokenId;
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
      .createAccount({ key: executorKey.publicKey, initialBalance: 50 })
      .then(resp => resp.accountId!);

    executorClient = getCustomClient(executorAccountId, executorKey);
    executorWrapper = new HederaOperationsWrapper(executorClient);

    // Setup agent
    testSetup = await createLangchainTestSetup(undefined, undefined, executorClient);
    agentExecutor = testSetup.agentExecutor;

    // Deploy fungible token
    tokenIdFT = await executorWrapper
      .createFungibleToken({
        ...FT_PARAMS,
        supplyKey: executorClient.operatorPublicKey! as PublicKey,
        adminKey: executorClient.operatorPublicKey! as PublicKey,
        treasuryAccountId: executorAccountId.toString(),
        autoRenewAccountId: executorAccountId.toString(),
      })
      .then(resp => resp.tokenId!);

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

  const createRecipientAccount = async (maxAutomaticTokenAssociations: number) => {
    const recipientKey = PrivateKey.generateED25519();

    return await executorWrapper
      .createAccount({
        key: recipientKey.publicKey,
        initialBalance: 0,
        maxAutomaticTokenAssociations,
      })
      .then(resp => resp.accountId!);
  };

  it(
    'should airdrop tokens to a single recipient successfully',
    itWithRetry(async () => {
      const recipientId = await createRecipientAccount(0); // no auto-association

      const queryResult = await agentExecutor.invoke({
        input: `Airdrop 50 of token ${tokenIdFT.toString()} from ${executorAccountId.toString()} to ${recipientId.toString()}`,
      });

      const observation = extractObservationFromLangchainResponse(queryResult);
      await wait(MIRROR_NODE_WAITING_TIME);

      expect(observation.humanMessage).toContain('Token successfully airdropped');
      expect(observation.raw.status).toBe('SUCCESS');

      const pending = await executorWrapper.getPendingAirdrops(recipientId.toString());
      expect(pending.airdrops.length).toBeGreaterThan(0);
    }),
  );

  it(
    'should airdrop tokens to multiple recipients in one transaction',
    itWithRetry(async () => {
      const recipient1 = await createRecipientAccount(0);
      const recipient2 = await createRecipientAccount(0);

      const queryResult = await agentExecutor.invoke({
        input: `Airdrop 10 of token ${tokenIdFT.toString()} from ${executorAccountId.toString()} to ${recipient1.toString()} and 20 to ${recipient2.toString()}`,
      });

      const observation = extractObservationFromLangchainResponse(queryResult);
      await wait(MIRROR_NODE_WAITING_TIME);

      expect(observation.raw.status).toBe('SUCCESS');

      const pending1 = await executorWrapper.getPendingAirdrops(recipient1.toString());
      const pending2 = await executorWrapper.getPendingAirdrops(recipient2.toString());

      expect(pending1.airdrops.length).toBeGreaterThan(0);
      expect(pending2.airdrops.length).toBeGreaterThan(0);
    }),
  );

  it(
    'should fail gracefully for non-existent token',
    itWithRetry(async () => {
      const recipientId = await createRecipientAccount(0);
      const fakeTokenId = '0.0.999999999';

      const queryResult = await agentExecutor.invoke({
        input: `Airdrop 5 of token ${fakeTokenId} from ${executorAccountId.toString()} to ${recipientId.toString()}`,
      });

      const observation = extractObservationFromLangchainResponse(queryResult);

      expect(observation.humanMessage).toContain('Failed to get token info for a token');
    }),
  );
});
