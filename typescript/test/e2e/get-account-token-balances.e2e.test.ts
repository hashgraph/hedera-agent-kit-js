import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import { AgentExecutor } from 'langchain/agents';
import {
  createLangchainTestSetup,
  HederaOperationsWrapper,
  type LangchainTestSetup,
} from '../utils';
import { Client, TokenSupplyType } from '@hashgraph/sdk';
import { extractObservationFromLangchainResponse, wait } from '../utils/general-util';
import { MIRROR_NODE_WAITING_TIME } from '../utils/test-constants';
import { itWithRetry } from '../utils/retry-util';

describe('Get Account Token Balances E2E Tests', () => {
  let testSetup: LangchainTestSetup;
  let agentExecutor: AgentExecutor;
  let operatorClient: Client;
  let operatorWrapper: HederaOperationsWrapper;
  let testAccountId: string;
  let tokenId: string;

  beforeAll(async () => {
    testSetup = await createLangchainTestSetup();
    agentExecutor = testSetup.agentExecutor;
    operatorClient = testSetup.client;
    operatorWrapper = new HederaOperationsWrapper(operatorClient);

    // Create a test account
    const accountResp = await operatorWrapper.createAccount({
      initialBalance: 0,
      key: operatorClient.operatorPublicKey!,
      maxAutomaticTokenAssociations: -1,
    });
    testAccountId = accountResp.accountId!.toString();

    // Create a fungible token
    const tokenResp = await operatorWrapper.createFungibleToken({
      tokenName: 'E2E Test Token',
      tokenSymbol: 'E2E',
      tokenMemo: 'E2E Testing Token',
      initialSupply: 100,
      decimals: 2,
      treasuryAccountId: operatorClient.operatorAccountId!.toString(),
      supplyType: TokenSupplyType.Infinite,
      adminKey: operatorClient.operatorPublicKey!,
    });
    tokenId = tokenResp.tokenId!.toString();

    // Transfer some balance to the test account
    await operatorWrapper.transferFungible({
      amount: 25,
      to: testAccountId,
      from: operatorClient.operatorAccountId!.toString(),
      tokenId,
    });

    // wait for mirror node indexing
    await wait(MIRROR_NODE_WAITING_TIME);
  });

  it(
    'should fetch token balances for a valid account',
    itWithRetry(async () => {
      const input = `Get the token balances for account ${testAccountId}`;

      const result = await agentExecutor.invoke({ input });

      const observation = extractObservationFromLangchainResponse(result);

      expect(observation).toBeDefined();
      expect(observation.humanMessage).toContain('Token Balances');
      expect(observation.humanMessage).toContain(`Token: ${tokenId}`);
      expect(observation.humanMessage).toContain(`Balance: 25`);
    }),
  );

  it(
    'should default to operator account when no account is passed',
    itWithRetry(async () => {
      const input = `Show me my token balances`;

      const result = await agentExecutor.invoke({ input });

      const observation = extractObservationFromLangchainResponse(result);

      expect(observation).toBeDefined();
      expect(observation.humanMessage).toContain('Token Balances');
      expect(observation.humanMessage).toContain(operatorClient.operatorAccountId!.toString());
    }),
  );

  it(
    'should handle non-existent account gracefully',
    itWithRetry(async () => {
      const nonExistentAccountId = '0.0.999999999';
      const input = `Get the token balances for account ${nonExistentAccountId}`;

      const result = await agentExecutor.invoke({ input });

      const observation = extractObservationFromLangchainResponse(result);

      expect(observation).toBeDefined();
      expect(observation.raw.error).toContain('Failed to fetch');
    }),
  );

  it(
    'should handle invalid account ID format',
    itWithRetry(async () => {
      const invalidAccountId = 'invalid-account-id';
      const input = `Get the token balances for account ${invalidAccountId}`;

      const result = await agentExecutor.invoke({ input });

      const observation = extractObservationFromLangchainResponse(result);

      expect(observation).toBeDefined();
      expect(observation.raw.error).toContain('Failed to fetch balance for account');
    }),
  );

  afterAll(async () => {
    if (testSetup) {
      testSetup.cleanup();
    }
  });
});
