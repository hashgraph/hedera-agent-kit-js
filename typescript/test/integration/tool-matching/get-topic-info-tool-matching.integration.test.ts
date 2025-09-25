import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { AgentExecutor } from 'langchain/agents';
import { HederaLangchainToolkit } from '@/langchain';
import { createLangchainTestSetup, type LangchainTestSetup } from '../../utils';
import { GET_TOPIC_INFO_QUERY_TOOL } from '@/plugins/core-consensus-query-plugin/tools/queries/get-topic-info-query';

describe.skip('Get Topic Info Tool Matching Integration Tests', () => {
  let testSetup: LangchainTestSetup;
  let agentExecutor: AgentExecutor;
  let toolkit: HederaLangchainToolkit;

  beforeAll(async () => {
    testSetup = await createLangchainTestSetup();
    agentExecutor = testSetup.agentExecutor;
    toolkit = testSetup.toolkit;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    if (testSetup) {
      testSetup.cleanup();
    }
  });

  describe.skip('Tool Matching and Parameter Extraction', () => {
    it('should match get topic info tool for simple request', async () => {
      const input = 'Get topic info for 0.0.1234';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        GET_TOPIC_INFO_QUERY_TOOL,
        expect.objectContaining({
          topicId: '0.0.1234',
        }),
      );
    });

    it('should handle various natural language variations', async () => {
      const variations = [
        { input: 'Show topic info 0.0.2222', topicId: '0.0.2222' },
        { input: 'Please get topic details for 0.0.3333', topicId: '0.0.3333' },
        { input: 'Display HCS topic 0.0.4444 info', topicId: '0.0.4444' },
      ];

      const hederaAPI = toolkit.getHederaAgentKitAPI();

      for (const variation of variations) {
        const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');
        await agentExecutor.invoke({ input: variation.input });

        expect(spy).toHaveBeenCalledOnce();
        expect(spy).toHaveBeenCalledWith(
          GET_TOPIC_INFO_QUERY_TOOL,
          expect.objectContaining({
            topicId: variation.topicId,
          }),
        );
        spy.mockRestore();
      }
    });
  });

  describe.skip('Tool Available', () => {
    it('should have get topic info tool available', () => {
      const tools = toolkit.getTools();
      const tool = tools.find(tool => tool.name === 'get_topic_info_query_tool');

      expect(tool).toBeDefined();
      expect(tool!.name).toBe('get_topic_info_query_tool');
      expect(tool!.description).toContain(
        'This tool will return the information for a given Hedera topic',
      );
    });
  });
});


