import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from '@hashgraph/sdk';
import createTopicTool from '@/plugins/core-consensus-plugin/tools/consensus/create-topic';
import { Context, AgentMode } from '@/shared/configuration';
import { getClientForTests } from '../../utils';
import { z } from 'zod';
import { createTopicParameters } from '@/shared/parameter-schemas/consensus.zod';

describe('Create Topic Integration Tests', () => {
  let client: Client;
  let context: Context;

  beforeAll(async () => {
    client = getClientForTests();

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

      expect(result.humanMessage).toContain('Topic created successfully');
      expect(result.raw.transactionId).toBeDefined();
      expect(result.raw.topicId).toBeDefined();
    });

    it('should create a topic with memo and submit key', async () => {
      const params: z.infer<ReturnType<typeof createTopicParameters>> = {
        topicMemo: 'Integration test topic',
        isSubmitKey: true,
      } as any;

      const tool = createTopicTool(context);
      const result: any = await tool.execute(client, context, params);

      expect(result.humanMessage).toContain('Topic created successfully');
      expect(result.raw.topicId).toBeDefined();
    });

    it('should handle empty string topicMemo', async () => {
      const params: z.infer<ReturnType<typeof createTopicParameters>> = {
        topicMemo: '',
        isSubmitKey: false,
      } as any;

      const tool = createTopicTool(context);
      const result: any = await tool.execute(client, context, params);

      // Empty string should be valid, so this should succeed
      expect(result.humanMessage).toContain('Topic created successfully');
      expect(result.raw.topicId).toBeDefined();
    });
  });
});
