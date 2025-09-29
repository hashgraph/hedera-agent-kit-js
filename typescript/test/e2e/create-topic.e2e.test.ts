import { afterAll, beforeAll, describe, it, expect } from 'vitest';
import { createLangchainTestSetup, HederaOperationsWrapper, LangchainTestSetup } from '../utils';
import { AgentExecutor } from 'langchain/agents';
import { Client, TransactionRecordQuery } from '@hashgraph/sdk';
import { extractObservationFromLangchainResponse } from '../utils/general-util';
import { itWithRetry } from '../utils/retry-util';

function extractTopicId(agentResult: any): string {
  const observation = extractObservationFromLangchainResponse(agentResult);

  if (!observation.raw?.topicId) {
    throw new Error('No raw.topicId found in observation');
  }

  // raw.topicId may be string via toString or object; normalize
  const topicId = observation.raw.topicId;
  if (typeof topicId === 'string') return topicId;
  if (topicId.shard && topicId.realm && topicId.num) {
    const { shard, realm, num } = topicId;
    return `${shard.low}.${realm.low}.${num.low}`;
  }
  if (topicId.toString) return topicId.toString();
  throw new Error('Unable to parse topicId');
}

describe('Create Topic E2E Tests', () => {
  let testSetup: LangchainTestSetup;
  let agentExecutor: AgentExecutor;
  let hederaOperationsWrapper: HederaOperationsWrapper;
  let client: Client;

  beforeAll(async () => {
    testSetup = await createLangchainTestSetup();
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
    it('should create a topic with default settings', itWithRetry(async () => {
      const input = `Create a new Hedera topic`;

      const result = await agentExecutor.invoke({ input });
      const topicId = extractTopicId(result);

      const topicInfo = await hederaOperationsWrapper.getTopicInfo(topicId);

      expect(typeof topicId).toBe('string');
      expect(topicId.split('.').length).toBe(3);
      expect(topicInfo).toBeDefined();
      expect(topicInfo.submitKey).toBeNull();
      expect(topicInfo.topicMemo).toBe('');
    }));

    it('should create a topic with memo and submit key', itWithRetry(async () => {
      const input = `Create a topic with memo "E2E test topic" and set submit key`;

      const result = await agentExecutor.invoke({ input });
      const topicId = extractTopicId(result);

      const topicInfo = await hederaOperationsWrapper.getTopicInfo(topicId);

      expect(typeof topicId).toBe('string');
      expect(topicId).toMatch(/\d+\.\d+\.\d+/);
      expect(topicInfo.submitKey?.toString()).toBe(client.operatorPublicKey?.toString());
    }));

    it('should create a topic with memo and do not restrict submit access', itWithRetry(async () => {
      const input = `Create a topic with memo "E2E test topic" and do not restrict submit access`;

      const result = await agentExecutor.invoke({ input });
      const topicId = extractTopicId(result);

      const topicInfo = await hederaOperationsWrapper.getTopicInfo(topicId);

      expect(typeof topicId).toBe('string');
      expect(topicId).toMatch(/\d+\.\d+\.\d+/);
      expect(topicInfo.submitKey).toBeNull();
    }));
    it('should create a topic with a transaction memo', itWithRetry(async () => {
      const txMemo = 'E2E transaction memo check';
      const input = `Create a new Hedera topic with transaction memo "${txMemo}"`;

      const result = await agentExecutor.invoke({ input });
      const observation = extractObservationFromLangchainResponse(result);

      expect(observation.raw?.transactionId).toBeDefined();

      const record = await new TransactionRecordQuery()
        .setTransactionId(observation.raw.transactionId)
        .execute(client);

      expect(record.transactionMemo).toBe(txMemo);
    }));
  });
});
