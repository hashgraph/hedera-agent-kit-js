import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client, TransactionRecordQuery } from '@hashgraph/sdk';
import createTopicTool from '@/plugins/core-consensus-plugin/tools/consensus/create-topic';
import { Context, AgentMode } from '@/shared/configuration';
import { getOperatorClientForTests, HederaOperationsWrapper } from '../../utils';
import { z } from 'zod';
import { createTopicParameters } from '@/shared/parameter-schemas/consensus.zod';

describe('Create Topic Integration Tests', () => {
  let client: Client;
  let context: Context;
  let hederaOperationsWrapper: HederaOperationsWrapper;

  beforeAll(async () => {
    client = getOperatorClientForTests();
    hederaOperationsWrapper = new HederaOperationsWrapper(client);

    context = {
      mode: AgentMode.AUTONOMOUS,
      accountId: client.operatorAccountId!.toString(),
    };
  });

  afterAll(async () => {
    if (client) {
      client.close();
    }
  });

  describe('Valid Create Topic Scenarios', () => {
    it('should create a topic with default params', async () => {
      const params: z.infer<ReturnType<typeof createTopicParameters>> = {} as any;

      const tool = createTopicTool(context);
      const result: any = await tool.execute(client, context, params);

      const topicInfo = await hederaOperationsWrapper.getTopicInfo(result.raw.topicId!.toString());

      expect(result.humanMessage).toContain('Topic created successfully');
      expect(result.raw.transactionId).toBeDefined();
      expect(result.raw.topicId).toBeDefined();
      expect(topicInfo).toBeDefined();
      expect(topicInfo.topicMemo).toBe('');
      expect(topicInfo.adminKey).toBeNull();
      expect(topicInfo.submitKey).toBeNull();
    });

    it('should create a topic with memo and submit key', async () => {
      const params: z.infer<ReturnType<typeof createTopicParameters>> = {
        topicMemo: 'Integration test topic',
        isSubmitKey: true,
      } as any;

      const tool = createTopicTool(context);
      const result: any = await tool.execute(client, context, params);

      const topicInfo = await hederaOperationsWrapper.getTopicInfo(result.raw.topicId!.toString());

      expect(result.humanMessage).toContain('Topic created successfully');
      expect(result.raw.topicId).toBeDefined();
      expect(topicInfo).toBeDefined();
      expect(topicInfo.topicMemo).toBe(params.topicMemo);
      expect(topicInfo.adminKey).toBeNull();
      expect(topicInfo.submitKey!.toString()).toBe(client.operatorPublicKey?.toStringDer());
    });

    it('should handle empty string topicMemo', async () => {
      const params: z.infer<ReturnType<typeof createTopicParameters>> = {
        topicMemo: '',
        isSubmitKey: false,
      } as any;

      const tool = createTopicTool(context);
      const result: any = await tool.execute(client, context, params);

      const topicInfo = await hederaOperationsWrapper.getTopicInfo(result.raw.topicId!.toString());

      // Empty string should be valid, so this should succeed
      expect(result.humanMessage).toContain('Topic created successfully');
      expect(result.raw.topicId).toBeDefined();
      expect(topicInfo.topicMemo).toBe(params.topicMemo);
      expect(topicInfo.submitKey).toBe(null);
    });

    it('should create a topic with a transaction memo', async () => {
      const params: z.infer<ReturnType<typeof createTopicParameters>> = {
        transactionMemo: 'integration tx memo',
      } as any;

      const tool = createTopicTool(context);
      const result: any = await tool.execute(client, context, params);

      const topicInfo = await hederaOperationsWrapper.getTopicInfo(result.raw.topicId!.toString());

      expect(result.humanMessage).toContain('Topic created successfully');
      expect(result.raw.topicId).toBeDefined();
      expect(topicInfo).toBeDefined();

      expect(result.raw.transactionId).toBeDefined();
      const record = await new TransactionRecordQuery()
        .setTransactionId(result.raw.transactionId)
        .execute(client);
      expect(record.transactionMemo).toBe(params.transactionMemo);
    });
  });
});
