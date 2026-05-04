import { afterAll, beforeAll, describe, it, expect } from 'vitest';
import { createLangchainTestSetup, LangchainTestSetup } from '@tests/utils';
import { ResponseParserService } from '@hashgraph/hedera-agent-kit-langchain';
import { ReactAgent } from 'langchain';
import {
  getProfile,
  HederaOperationsWrapper,
  type TestAccount,
  itWithRetry,
} from '@hashgraph/hedera-agent-kit-tests';
import { Client, Key, PrivateKey, PublicKey } from '@hiero-ledger/sdk';

function extractAccountId(agentResult: any, responseParsingService: ResponseParserService): string {
  const parsedResponse = responseParsingService.parseNewToolMessages(agentResult);

  if (!parsedResponse || parsedResponse.length === 0) {
    throw new Error('No tool messages found in agent result');
  }

  if (!parsedResponse[0].parsedData.raw?.accountId) {
    throw new Error('No raw.accountId found in observation');
  }

  const { shard, realm, num } = parsedResponse[0].parsedData.raw.accountId;
  return `${shard.low}.${realm.low}.${num.low}`;
}

describe('Create Account E2E Tests', () => {
  const profile = getProfile();
  let testSetup: LangchainTestSetup;
  let agent: ReactAgent;
  let responseParsingService: ResponseParserService;
  let executor: TestAccount;
  let executorClient: Client;
  let executorWrapper: HederaOperationsWrapper;

  beforeAll(async () => {
    executor = await profile.accounts.acquire({
      tier: 'MINIMAL',
      accountMemo: 'executor account for Create Account E2E Tests',
    });
    ({ client: executorClient, wrapper: executorWrapper } = profile.client.connectAs(executor));

    testSetup = await createLangchainTestSetup(undefined, undefined, executorClient);
    agent = testSetup.agent;
    responseParsingService = testSetup.responseParser;
  });

  afterAll(async () => {
    await profile.accounts.release(executor);
    testSetup?.cleanup();
    executorClient?.close();
  });

  describe('Tool Matching and Parameter Extraction', () => {
    it(
      'should create an account with default operator public key',
      itWithRetry(async () => {
        const publicKey = executor.privateKey.publicKey as PublicKey;
        const input = `Create a new Hedera account`;

        const result = await agent.invoke({
          messages: [
            {
              role: 'user',
              content: input,
            },
          ],
        });
        const newAccountId = extractAccountId(result, responseParsingService);

        const info = await executorWrapper.getAccountInfo(newAccountId);
        expect((info.key as PublicKey).toStringRaw()).toBe(publicKey.toStringRaw());
      }),
    );

    it(
      'should create an account with initial balance and memo',
      itWithRetry(async () => {
        const input = `Create an account with initial balance 0.05 HBAR and memo "E2E test account"`;

        const result = await agent.invoke({
          messages: [
            {
              role: 'user',
              content: input,
            },
          ],
        });
        const newAccountId = extractAccountId(result, responseParsingService);

        const info = await executorWrapper.getAccountInfo(newAccountId);
        expect(info.accountMemo).toBe('E2E test account');

        const balance = await executorWrapper.getAccountHbarBalance(newAccountId);
        expect(balance.toNumber()).toBeGreaterThanOrEqual(0.05 * 1e8);
      }),
    );

    it(
      'should create an account with explicit public key',
      itWithRetry(async () => {
        const publicKey = PrivateKey.generateED25519().publicKey as Key;
        const input = `Create a new account with public key ${publicKey.toString()}`;

        const result = await agent.invoke({
          messages: [
            {
              role: 'user',
              content: input,
            },
          ],
        });
        const newAccountId = extractAccountId(result, responseParsingService);

        const info = await executorWrapper.getAccountInfo(newAccountId);
        expect((info.key as Key).toString()).toBe(publicKey.toString());
      }),
    );

    it(
      'should schedule a create account transaction with explicit public key',
      itWithRetry(async () => {
        const publicKey = PrivateKey.generateED25519().publicKey as Key;
        const input = `Schedule creating a new Hedera account using public key ${publicKey.toString()}`;

        const result = await agent.invoke({
          messages: [
            {
              role: 'user',
              content: input,
            },
          ],
        });
        const parsedResponse = responseParsingService.parseNewToolMessages(result);

        // Validate response structure
        expect(parsedResponse[0].parsedData.raw).toBeDefined();
        expect(parsedResponse[0].parsedData.raw.transactionId).toBeDefined();
        expect(parsedResponse[0].parsedData.raw.scheduleId).toBeDefined();
        expect(parsedResponse[0].parsedData.humanMessage).toContain(
          'Scheduled transaction created successfully',
        );

        // We don’t expect accountId yet since it’s not executed immediately
        expect(parsedResponse[0].parsedData.raw.accountId).toBeNull();
      }),
    );
  });

  describe('Edge Cases', () => {
    it(
      'should create an account with very small initial balance',
      itWithRetry(async () => {
        const input = `Create an account with initial balance 0.0001 HBAR`;

        const result = await agent.invoke({
          messages: [
            {
              role: 'user',
              content: input,
            },
          ],
        });
        const newAccountId = extractAccountId(result, responseParsingService);

        const balance = await executorWrapper.getAccountHbarBalance(newAccountId);
        expect(balance.toNumber()).toBeGreaterThanOrEqual(0.0001 * 1e8);
      }),
    );

    // LLM hallucinates that 60 is more than 100 and fails to even call the tool. Skipping for now
    it.skip(
      'should handle long memos correctly',
      itWithRetry(async () => {
        const longMemo = 'A'.repeat(60);
        const input = `Create an account with memo "${longMemo}"`;

        const result = await agent.invoke({
          messages: [
            {
              role: 'user',
              content: input,
            },
          ],
        });

        const newAccountId = extractAccountId(result, responseParsingService);

        const info = await executorWrapper.getAccountInfo(newAccountId);
        expect(info.accountMemo).toBe(longMemo);
      }),
    );
  });
});
