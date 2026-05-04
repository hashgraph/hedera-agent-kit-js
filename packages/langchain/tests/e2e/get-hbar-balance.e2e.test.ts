import { afterAll, beforeAll, describe, it, expect } from 'vitest';
import { Client } from '@hiero-ledger/sdk';
import { ReactAgent } from 'langchain';
import { createLangchainTestSetup, LangchainTestSetup } from '@tests/utils';
import {
  getProfile,
  HederaOperationsWrapper,
  type TestAccount,
  waitFor,
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

  // Pulls the numeric balance out of the agent's natural-language reply.
  // Tolerant comparisons against this protect tests from per-call Hedera fees that the
  // executor pays whenever the agent queries on its behalf. Comparing pre-call balance
  // snapshots to post-call mirror reads will always drift by the fee otherwise.
  const extractReportedBalance = (humanMessage: string, accountId: string): number => {
    const re = new RegExp(
      `Account ${accountId.replace(/\./g, '\\.')} has a balance of ([\\d.]+) HBAR`,
    );
    const match = humanMessage.match(re);
    if (!match) throw new Error(`Expected balance line for ${accountId}, got:\n${humanMessage}`);
    return parseFloat(match[1]);
  };

  it(
    'should return balance when asking for default executor account',
    async () => {
      const executorId = executor.accountId.toString();
      const executorBalance = await executorWrapper.getAccountHbarBalance(executorId);

      const input = `What is the HBAR balance of ${executorId}?`;
      const result = await agent.invoke({
        messages: [{ role: 'user', content: input }],
      });

      const parsedResponse = responseParsingService.parseNewToolMessages(result);
      const expectedBalance = toDisplayUnit(executorBalance, 8).toNumber();

      expect(parsedResponse[0].parsedData.raw.accountId).toBe(executorId);
      // Tolerate ~0.05 HBAR. The executor pays fees for the agent's mirror queries.
      expect(
        extractReportedBalance(parsedResponse[0].parsedData.humanMessage, executorId),
      ).toBeCloseTo(expectedBalance, 1);
      expect(parseFloat(parsedResponse[0].parsedData.raw.hbarBalance)).toBeCloseTo(
        expectedBalance,
        1,
      );
    },
  );

  it(
    'should return balance for specific account with non-zero balance',
    async () => {
      const accountId = targetAccount1.accountId.toString();
      const balance = await executorWrapper.getAccountHbarBalance(accountId);
      const expectedDisplay = toDisplayUnit(balance, 8).toNumber();

      const input = `What is the HBAR balance of ${accountId}?`;
      const result = await agent.invoke({
        messages: [{ role: 'user', content: input }],
      });

      const parsedResponse = responseParsingService.parseNewToolMessages(result);

      expect(parsedResponse[0].parsedData.raw.accountId).toBe(accountId);
      // Target account doesn't pay fees, but stay tolerant for consistency / future-proofing.
      expect(
        extractReportedBalance(parsedResponse[0].parsedData.humanMessage, accountId),
      ).toBeCloseTo(expectedDisplay, 1);
      expect(parseFloat(parsedResponse[0].parsedData.raw.hbarBalance)).toBeCloseTo(
        expectedDisplay,
        1,
      );
    },
  );

  it(
    'should return balance for specific account with zero balance',
    async () => {
      const accountId = targetAccount2.accountId.toString();
      const balance = await executorWrapper.getAccountHbarBalance(accountId);
      const expectedDisplay = toDisplayUnit(balance, 8).toNumber();

      const input = `What is the HBAR balance of ${accountId}?`;
      const result = await agent.invoke({
        messages: [{ role: 'user', content: input }],
      });

      const parsedResponse = responseParsingService.parseNewToolMessages(result);

      expect(parsedResponse[0].parsedData.raw.accountId).toBe(accountId);
      expect(
        extractReportedBalance(parsedResponse[0].parsedData.humanMessage, accountId),
      ).toBeCloseTo(expectedDisplay, 1);
      expect(parseFloat(parsedResponse[0].parsedData.raw.hbarBalance)).toBeCloseTo(
        expectedDisplay,
        1,
      );
    },
  );
});
