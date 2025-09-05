import { afterAll, beforeAll, describe, it, expect } from 'vitest';
import { createLangchainTestSetup, LangchainTestSetup } from '../utils';
import { AgentExecutor } from 'langchain/agents';
import HederaOperationsWrapper from '../utils/hedera-operations/HederaOperationsWrapper';
import { Client, Key, PrivateKey, PublicKey } from '@hashgraph/sdk';
import { extractObservationFromLangchainResponse } from '../utils/general-util';

// Helper function to extract accountId from agentExecutor result
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
  let client: Client;
  let hederaOperationsWrapper: HederaOperationsWrapper;

  beforeAll(async () => {
    testSetup = await createLangchainTestSetup(); // picks E2E LLM provider automatically
    agentExecutor = testSetup.agentExecutor;
    client = testSetup.client;
    hederaOperationsWrapper = new HederaOperationsWrapper(client);
  });

  afterAll(async () => {
    if (testSetup) {
      testSetup.cleanup();
    }
  });

  describe('Tool Matching and Parameter Extraction', () => {
    it('should create an account with default operator public key', async () => {
      const input = `Create a new Hedera account`;
      const publicKey = client.operatorPublicKey as PublicKey;

      const result = await agentExecutor.invoke({ input });
      const newAccountId = extractAccountId(result);

      const info = await hederaOperationsWrapper.getAccountInfo(newAccountId);
      expect((info.key as PublicKey).toStringRaw()).toBe(publicKey.toStringRaw());
    });

    it('should create an account with initial balance and memo', async () => {
      const input = `Create an account with initial balance 0.05 HBAR and memo "E2E test account"`;

      const result = await agentExecutor.invoke({ input });
      const newAccountId = extractAccountId(result);

      const info = await hederaOperationsWrapper.getAccountInfo(newAccountId);
      expect(info.accountMemo).toBe('E2E test account');

      const balance = await hederaOperationsWrapper.getAccountHbarBalance(newAccountId);
      expect(balance.toNumber()).toBeGreaterThanOrEqual(0.05 * 1e8); // tinybars
    });

    it('should create an account with explicit public key', async () => {
      const publicKey = PrivateKey.generateED25519().publicKey as Key;
      const input = `Create a new account with public key ${publicKey.toString()}`;

      const result = await agentExecutor.invoke({ input });
      const newAccountId = extractAccountId(result);

      const info = await hederaOperationsWrapper.getAccountInfo(newAccountId);
      expect((info.key as Key).toString()).toBe(publicKey.toString());
    });
  });

  describe('Edge Cases', () => {
    it('should create an account with very small initial balance', async () => {
      const input = `Create an account with initial balance 0.0001 HBAR`;

      const result = await agentExecutor.invoke({ input });
      const newAccountId = extractAccountId(result);

      const balance = await hederaOperationsWrapper.getAccountHbarBalance(newAccountId);
      expect(balance.toNumber()).toBeGreaterThanOrEqual(0.0001 * 1e8);
    });

    it('should handle long memos correctly', async () => {
      const longMemo = 'A'.repeat(90);
      const input = `Create an account with memo "${longMemo}"`;

      const result = await agentExecutor.invoke({ input });
      const newAccountId = extractAccountId(result);

      const info = await hederaOperationsWrapper.getAccountInfo(newAccountId);
      expect(info.accountMemo).toBe(longMemo);
    });
  });
});
