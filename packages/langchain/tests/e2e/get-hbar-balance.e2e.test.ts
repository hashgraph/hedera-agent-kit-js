import { afterAll, beforeAll, describe, it, expect } from 'vitest';
import { Client } from '@hiero-ledger/sdk';
import { ReactAgent } from 'langchain';
import { createLangchainTestSetup, LangchainTestSetup } from '@tests/utils';
import {
  getProfile,
  HederaOperationsWrapper,
  type TestAccount,
  waitFor,
  itWithRetry,
} from '@hashgraph/hedera-agent-kit-tests';
import { toDisplayUnit } from '@hashgraph/hedera-agent-kit';
import { ResponseParserService } from '@hashgraph/hedera-agent-kit-langchain';

describe('Get HBAR Balance E2E Tests with Intermediate Execution Account', () => {
  const profile = getProfile();
  let testSetup: LangchainTestSetup;
  let agent: ReactAgent;
  let responseParsingService: ResponseParserService;
  let executor: TestAccount;
  let executorClient: Client;
  let executorWrapper: HederaOperationsWrapper;
  let targetAccount1: TestAccount;
  let targetAccount2: TestAccount;

  beforeAll(async () => {
    executor = await profile.accounts.acquire({ tier: 'MINIMAL' });
    ({ client: executorClient, wrapper: executorWrapper } = profile.client.connectAs(executor));

    // LangChain setup using executor client
    testSetup = await createLangchainTestSetup(undefined, undefined, executorClient);
    agent = testSetup.agent;
    responseParsingService = testSetup.responseParser;

    // create test accounts
    targetAccount1 = await profile.accounts.acquire({ tier: 'MINIMAL' });
    targetAccount2 = await profile.accounts.acquire({ tier: 'MINIMAL' });

    // Adaptive wait: poll mirror until the new accounts are visible
    await waitFor(
      async () => {
        try {
          await executorWrapper.getAccountBalances(targetAccount2.accountId.toString());
          return true;
        } catch {
          return null;
        }
      },
      { timeoutMs: 10000, intervalMs: 250, description: 'new accounts to appear in mirror' },
    );
  });

  afterAll(async () => {
    await profile.accounts.release(targetAccount1);
    await profile.accounts.release(targetAccount2);
    await profile.accounts.release(executor);
    testSetup?.cleanup();
    executorClient?.close();
  });

  it(
    'should return balance when asking for default executor account',
    itWithRetry(async () => {
      const executorId = executor.accountId.toString();
      const executorBalance = await executorWrapper.getAccountHbarBalance(executorId);

      const input = `What is the HBAR balance of ${executorId}?`;
      const result = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: input,
          },
        ],
      });

      const parsedResponse = responseParsingService.parseNewToolMessages(result);

      expect(parsedResponse[0].parsedData.raw.accountId).toBe(executorId);
      expect(parsedResponse[0].parsedData.humanMessage).toContain(
        `Account ${executorId} has a balance of ${toDisplayUnit(executorBalance, 8).toNumber()}`,
      );
      expect(parsedResponse[0].parsedData.raw.hbarBalance).toBe(
        toDisplayUnit(executorBalance, 8).toString(),
      );
    }),
  );

  it(
    'should return balance for specific account with non-zero balance',
    itWithRetry(async () => {
      const accountId = targetAccount1.accountId.toString();
      const balance = await executorWrapper.getAccountHbarBalance(accountId);
      const expectedDisplay = toDisplayUnit(balance, 8).toNumber();

      const input = `What is the HBAR balance of ${accountId}?`;
      const result = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: input,
          },
        ],
      });

      const parsedResponse = responseParsingService.parseNewToolMessages(result);

      expect(parsedResponse[0].parsedData.raw.accountId).toBe(accountId);
      expect(parsedResponse[0].parsedData.humanMessage).toContain(
        `Account ${accountId} has a balance of ${expectedDisplay}`,
      );
      expect(parsedResponse[0].parsedData.raw.hbarBalance).toBe(expectedDisplay.toString());
    }),
  );

  it(
    'should return balance for specific account with zero balance',
    itWithRetry(async () => {
      const accountId = targetAccount2.accountId.toString();
      const balance = await executorWrapper.getAccountHbarBalance(accountId);
      const expectedDisplay = toDisplayUnit(balance, 8).toNumber();

      const input = `What is the HBAR balance of ${accountId}?`;
      const result = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: input,
          },
        ],
      });

      const parsedResponse = responseParsingService.parseNewToolMessages(result);

      expect(parsedResponse[0].parsedData.raw.accountId).toBe(accountId);
      expect(parsedResponse[0].parsedData.humanMessage).toContain(
        `Account ${accountId} has a balance of ${expectedDisplay}`,
      );
      expect(parsedResponse[0].parsedData.raw.hbarBalance).toBe(expectedDisplay.toString());
    }),
  );
});
