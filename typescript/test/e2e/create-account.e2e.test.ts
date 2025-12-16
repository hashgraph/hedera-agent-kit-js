import { afterAll, beforeAll, describe, it, expect } from 'vitest';
import {
  createLangchainTestSetup,
  getCustomClient,
  getOperatorClientForTests,
  LangchainTestSetup,
} from '../utils';
import { ResponseParserService } from '@/langchain';
import { ReactAgent } from 'langchain';
import HederaOperationsWrapper from '../utils/hedera-operations/HederaOperationsWrapper';
import { Client, Key, PrivateKey, PublicKey } from '@hashgraph/sdk';
import { itWithRetry } from '../utils/retry-util';
import { UsdToHbarService } from '../utils/usd-to-hbar-service';
import { BALANCE_TIERS } from '../utils/setup/langchain-test-config';

function extractAccountId(agentResult: any, responseParsingService: ResponseParserService): string {
  const parsedResponse = responseParsingService.parseNewToolMessages(agentResult);

  if (!parsedResponse[0].parsedData.raw?.accountId) {
    throw new Error('No raw.accountId found in observation');
  }

  const { shard, realm, num } = parsedResponse[0].parsedData.raw.accountId;
  return `${shard.low}.${realm.low}.${num.low}`;
}

describe('Create Account E2E Tests', () => {
  let testSetup: LangchainTestSetup;
  let agent: ReactAgent;
  let responseParsingService: ResponseParserService;
  let executorClient: Client;
  let operatorClient: Client;
  let executorWrapper: HederaOperationsWrapper;

  beforeAll(async () => {
    operatorClient = getOperatorClientForTests();
    const operatorWrapper = new HederaOperationsWrapper(operatorClient);

    const executorAccountKey = PrivateKey.generateED25519();
    const executorAccountId = await operatorWrapper
      .createAccount({ key: executorAccountKey.publicKey, initialBalance: UsdToHbarService.usdToHbar(BALANCE_TIERS.MINIMAL) })
      .then(resp => resp.accountId!);

    executorClient = getCustomClient(executorAccountId, executorAccountKey);

    testSetup = await createLangchainTestSetup(undefined, undefined, executorClient);
    agent = testSetup.agent;
    responseParsingService = testSetup.responseParser;
    executorWrapper = new HederaOperationsWrapper(executorClient);
  });

  afterAll(async () => {
    if (testSetup && operatorClient) {
      await executorWrapper.deleteAccount({
        accountId: executorClient.operatorAccountId!,
        transferAccountId: operatorClient.operatorAccountId!,
      });
      testSetup.cleanup();
      operatorClient.close();
    }
  });

  describe('Tool Matching and Parameter Extraction', () => {
    it(
      'should create an account with default operator public key',
      itWithRetry(async () => {
        const publicKey = executorClient.operatorPublicKey as PublicKey;
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

    it(
      'should handle long memos correctly',
      itWithRetry(async () => {
        const longMemo = 'A'.repeat(90);
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
