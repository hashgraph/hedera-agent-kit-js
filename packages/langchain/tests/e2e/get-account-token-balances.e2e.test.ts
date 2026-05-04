import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import { ReactAgent } from 'langchain';
import { createLangchainTestSetup, type LangchainTestSetup } from '@tests/utils';
import {
  getProfile,
  HederaOperationsWrapper,
  type TestAccount,
  wait,
  MIRROR_NODE_WAITING_TIME,
  itWithRetry,
} from '@hashgraph/hedera-agent-kit-tests';
import { ResponseParserService } from '@hashgraph/hedera-agent-kit-langchain';
import { Client, TokenSupplyType } from '@hiero-ledger/sdk';

describe('Get Account Token Balances E2E Tests', () => {
  const profile = getProfile();
  let testSetup: LangchainTestSetup;
  let agent: ReactAgent;
  let responseParsingService: ResponseParserService;
  let executor: TestAccount;
  let executorClient: Client;
  let executorWrapper: HederaOperationsWrapper;
  let testAccount: TestAccount;
  let testAccountId: string;
  let tokenId: string;

  beforeAll(async () => {
    executor = await profile.accounts.acquire({ tier: 'STANDARD' });
    ({ client: executorClient, wrapper: executorWrapper } = profile.client.connectAs(executor));

    testSetup = await createLangchainTestSetup(undefined, undefined, executorClient);
    agent = testSetup.agent;
    responseParsingService = testSetup.responseParser;

    // Create a test account that auto-associates tokens via airdrop preset (max=0 not desired here)
    testAccount = await profile.accounts.acquire({ tier: 'MINIMAL' });
    testAccountId = testAccount.accountId.toString();

    // Create a fungible token
    const tokenResp = await executorWrapper.createFungibleToken({
      tokenName: 'E2E Test Token',
      tokenSymbol: 'E2E',
      tokenMemo: 'E2E Testing Token',
      initialSupply: 100, // given in base units. Equals to 1 in display units
      decimals: 2,
      treasuryAccountId: executor.accountId.toString(),
      supplyType: TokenSupplyType.Infinite,
      adminKey: executor.privateKey.publicKey,
    });
    tokenId = tokenResp.tokenId!.toString();

    // Associate the test account with the token (since acquire doesn't enable -1)
    const { wrapper: testAccountWrapper, client: testAccountClient } =
      profile.client.connectAs(testAccount);
    await testAccountWrapper.associateToken({
      accountId: testAccountId,
      tokenId,
    });
    testAccountClient.close();

    // Transfer some balance to the test account
    await executorWrapper.transferFungible({
      amount: 25, // given in base units. Equals to 0.25 in display units
      to: testAccountId,
      from: executor.accountId.toString(),
      tokenId,
    });

    // wait for mirror node indexing
    await wait(MIRROR_NODE_WAITING_TIME);
  });

  it(
    'should fetch token balances for a valid account',
    itWithRetry(async () => {
      const input = `Get the token balances for account ${testAccountId}`;

      const result = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: input,
          },
        ],
      });

      const parsedResponse = responseParsingService.parseNewToolMessages(result);

      expect(parsedResponse).toBeDefined();
      expect(parsedResponse[0].parsedData.humanMessage).toContain('Token Balances');
      expect(parsedResponse[0].parsedData.humanMessage).toContain(`Token: ${tokenId}`);
      expect(parsedResponse[0].parsedData.humanMessage).toContain(`Balance: 0.25`);
    }),
  );

  it(
    'should default to operator account when no account is passed',
    itWithRetry(async () => {
      const input = `Show me my token balances`;

      const result = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: input,
          },
        ],
      });

      const parsedResponse = responseParsingService.parseNewToolMessages(result);

      expect(parsedResponse).toBeDefined();
      expect(parsedResponse[0].parsedData.humanMessage).toContain('Token Balances');
      expect(parsedResponse[0].parsedData.humanMessage).toContain(executor.accountId.toString());
    }),
  );

  it(
    'should handle non-existent account gracefully',
    itWithRetry(async () => {
      const nonExistentAccountId = '0.0.999999999';
      const input = `Get the token balances for account ${nonExistentAccountId}`;

      const result = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: input,
          },
        ],
      });

      const parsedResponse = responseParsingService.parseNewToolMessages(result);

      expect(parsedResponse).toBeDefined();
      expect(parsedResponse[0].parsedData.raw.error).toContain('Failed to fetch');
    }),
  );

  it(
    'should handle invalid account ID format',
    itWithRetry(async () => {
      const invalidAccountId = 'invalid-account-id';
      const input = `Get the token balances for account ${invalidAccountId}`;

      const result = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: input,
          },
        ],
      });

      const parsedResponse = responseParsingService.parseNewToolMessages(result);

      expect(parsedResponse).toBeDefined();
      expect(parsedResponse[0].parsedData.raw.error).toContain(
        'Failed to fetch balance for account',
      );
    }),
  );

  afterAll(async () => {
    await profile.accounts.release(testAccount);
    await profile.accounts.release(executor);
    testSetup?.cleanup();
    executorClient?.close();
  });
});
