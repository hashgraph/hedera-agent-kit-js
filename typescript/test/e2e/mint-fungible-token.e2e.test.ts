import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Client, PrivateKey, AccountId, TokenId, TokenSupplyType, PublicKey } from '@hashgraph/sdk';
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

describe('Mint Fungible Token E2E Tests', () => {
  let operatorClient: Client;
  let executorClient: Client;
  let executorAccountId: AccountId;
  let executorWrapper: HederaOperationsWrapper;
  let tokenIdFT: TokenId;
  let testSetup: LangchainTestSetup;
  let agentExecutor: AgentExecutor;

  const FT_PARAMS = {
    tokenName: 'MintableToken',
    tokenSymbol: 'MINT',
    tokenMemo: 'FT',
    initialSupply: 100,
    decimals: 2,
    maxSupply: 1000,
    supplyType: TokenSupplyType.Finite,
  };

  beforeAll(async () => {
    operatorClient = getOperatorClientForTests();
    const operatorWrapper = new HederaOperationsWrapper(operatorClient);

    const executorKey = PrivateKey.generateED25519();
    executorAccountId = await operatorWrapper
      .createAccount({ key: executorKey.publicKey, initialBalance: 50 })
      .then(resp => resp.accountId!);

    executorClient = getCustomClient(executorAccountId, executorKey);
    executorWrapper = new HederaOperationsWrapper(executorClient);

    testSetup = await createLangchainTestSetup(undefined, undefined, executorClient);
    agentExecutor = testSetup.agentExecutor;

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

  beforeEach(async () => {
    await new Promise(resolve => setTimeout(resolve, 30000));
  });

  it(
    'should mint additional supply successfully',
    itWithRetry(async () => {
      const supplyBefore = await executorWrapper
        .getTokenInfo(tokenIdFT.toString())
        .then(info => info.totalSupply.toInt());

      const queryResult = await agentExecutor.invoke({
        input: `Mint 5 of token ${tokenIdFT.toString()}`,
      });

      const observation = extractObservationFromLangchainResponse(queryResult);
      await wait(MIRROR_NODE_WAITING_TIME);

      const supplyAfter = await executorWrapper
        .getTokenInfo(tokenIdFT.toString())
        .then(info => info.totalSupply.toInt());

      expect(observation.humanMessage).toContain('Tokens successfully minted');
      expect(observation.raw.status).toBe('SUCCESS');
      expect(supplyAfter).toBe(supplyBefore + 500); // 5 * 10^decimals
    }),
  );

  it(
    'should schedule minting additional supply successfully',
    itWithRetry(async () => {
      const updateResult = await agentExecutor.invoke({
        input: `Mint 5 of token ${tokenIdFT.toString()}. Schedule the transaction instead of executing it immediately.`,
      });

      const observation = extractObservationFromLangchainResponse(updateResult);
      expect(observation.humanMessage).toContain(
        'Scheduled mint transaction created successfully.',
      );
      expect(observation.raw.scheduleId).toBeDefined();
    }),
  );

  it(
    'should fail gracefully when minting more than max supply',
    itWithRetry(async () => {
      const queryResult = await agentExecutor.invoke({
        input: `Mint 5000 of token ${tokenIdFT.toString()}`,
      });

      const observation = extractObservationFromLangchainResponse(queryResult);

      expect(observation.raw).toBeDefined();
      expect(observation.raw.error).toContain('TOKEN_MAX_SUPPLY_REACHED');
    }),
  );

  it(
    'should fail gracefully for a non-existent token',
    itWithRetry(async () => {
      const fakeTokenId = '0.0.999999999';

      const queryResult = await agentExecutor.invoke({
        input: `Mint 10 of token ${fakeTokenId}`,
      });

      const observation = extractObservationFromLangchainResponse(queryResult);

      expect(observation.humanMessage).toContain('Not Found');
      expect(observation.raw.error).toContain('Not Found');
      expect(observation.humanMessage).toContain(
        `Failed to get token info for a token ${fakeTokenId}`,
      );
      expect(observation.raw.error).toContain(
        `Failed to get token info for a token ${fakeTokenId}`,
      );
    }),
  );
});
