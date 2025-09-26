import { afterAll, beforeAll, describe, it, expect } from 'vitest';
import {
  createLangchainTestSetup,
  getCustomClient,
  getOperatorClientForTests,
  LangchainTestSetup,
} from '../utils';
import { AgentExecutor } from 'langchain/agents';
import HederaOperationsWrapper from '../utils/hedera-operations/HederaOperationsWrapper';
import { Client, Key, PrivateKey, PublicKey } from '@hashgraph/sdk';
import { extractObservationFromLangchainResponse } from '../utils/general-util';
import { itWithRetry } from '../utils/retry-util';

// Extracts accountId string (shard.realm.num) from agentExecutor result
function extractAccountId(agentResult: any): string {
  const observation = extractObservationFromLangchainResponse(agentResult);

  if (!observation.raw?.accountId) {
    throw new Error('No raw.accountId found in observation');
  }

  const { shard, realm, num } = observation.raw.accountId;
  return `${shard.low}.${realm.low}.${num.low}`;
}

describe('Create Account E2E Tests', () => {
  let testSetup: LangchainTestSetup;
  let agentExecutor: AgentExecutor;
  let executorClient: Client;
  let operatorClient: Client;
  let executorWrapper: HederaOperationsWrapper;

  // The operator account (from env variables) funds the setup process.
  // 1. An executor account is created using the operator account as the source of HBARs.
  // 2. The executor account is used to perform all Hedera operations required for the tests.
  // 3. LangChain is configured to run with the executor account as its client.
  // 4. After all tests are complete, the executor account is deleted and its remaining balance
  //    is transferred back to the operator account.
  beforeAll(async () => {
    // Use operator Client to fund a temporary executor account
    operatorClient = getOperatorClientForTests();
    const operatorWrapper = new HederaOperationsWrapper(operatorClient);

    const executorAccountKey = PrivateKey.generateED25519();
    const executorAccountId = await operatorWrapper
      .createAccount({ key: executorAccountKey.publicKey, initialBalance: 5 })
      .then(resp => resp.accountId!);

    executorClient = getCustomClient(executorAccountId, executorAccountKey);

    testSetup = await createLangchainTestSetup(undefined, undefined, executorClient);
    agentExecutor = testSetup.agentExecutor;
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
    it('should create an account with default operator public key', itWithRetry(async () => {
      const publicKey = executorClient.operatorPublicKey as PublicKey;
      const input = `Create a new Hedera account`;

      const result = await agentExecutor.invoke({ input });
      const newAccountId = extractAccountId(result);

      const info = await executorWrapper.getAccountInfo(newAccountId);
      expect((info.key as PublicKey).toStringRaw()).toBe(publicKey.toStringRaw());
    }));

    it('should create an account with initial balance and memo', itWithRetry(async () => {
      const input = `Create an account with initial balance 0.05 HBAR and memo "E2E test account"`;

      const result = await agentExecutor.invoke({ input });
      const newAccountId = extractAccountId(result);

      const info = await executorWrapper.getAccountInfo(newAccountId);
      expect(info.accountMemo).toBe('E2E test account');

      const balance = await executorWrapper.getAccountHbarBalance(newAccountId);
      expect(balance.toNumber()).toBeGreaterThanOrEqual(0.05 * 1e8); // tinybars
    }));

    it('should create an account with explicit public key', itWithRetry(async () => {
      const publicKey = PrivateKey.generateED25519().publicKey as Key;
      const input = `Create a new account with public key ${publicKey.toString()}`;

      const result = await agentExecutor.invoke({ input });
      const newAccountId = extractAccountId(result);

      const info = await executorWrapper.getAccountInfo(newAccountId);
      expect((info.key as Key).toString()).toBe(publicKey.toString());
    }));
  });

  describe('Edge Cases', () => {
    it('should create an account with very small initial balance', itWithRetry(async () => {
      const input = `Create an account with initial balance 0.0001 HBAR`;

      const result = await agentExecutor.invoke({ input });
      const newAccountId = extractAccountId(result);

      const balance = await executorWrapper.getAccountHbarBalance(newAccountId);
      expect(balance.toNumber()).toBeGreaterThanOrEqual(0.0001 * 1e8);
    }));

    it('should handle long memos correctly', itWithRetry(async () => {
      const longMemo = 'A'.repeat(90);
      const input = `Create an account with memo "${longMemo}"`;

      const result = await agentExecutor.invoke({ input });
      const newAccountId = extractAccountId(result);

      const info = await executorWrapper.getAccountInfo(newAccountId);
      expect(info.accountMemo).toBe(longMemo);
    }));
  });
});
