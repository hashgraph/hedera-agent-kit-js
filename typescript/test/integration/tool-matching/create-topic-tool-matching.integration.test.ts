import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { AgentExecutor } from 'langchain/agents';
import { HederaLangchainToolkit } from '@/langchain';
import { createLangchainTestSetup, type LangchainTestSetup } from '../../utils';
import { coreConsensusPluginToolNames } from '@/plugins';

describe.skip('Create Topic Tool Matching Integration Tests', () => {
  let testSetup: LangchainTestSetup;
  let agentExecutor: AgentExecutor;
  let toolkit: HederaLangchainToolkit;
  const { CREATE_TOPIC_TOOL } = coreConsensusPluginToolNames;

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
    it('should match create topic tool with default params', async () => {
      const input = 'Create a new topic';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue(''); //spies on the run method of the HederaAgentKitAPI and stops it from executing

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(CREATE_TOPIC_TOOL, expect.objectContaining({}));
    });

    it('should match create topic tool with memo and submit key', async () => {
      const input = 'Create a topic with memo "Payments" and set submit key';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue(''); //spies on the run method of the HederaAgentKitAPI and stops it from executing

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        CREATE_TOPIC_TOOL,
        expect.objectContaining({
          topicMemo: 'Payments',
          isSubmitKey: true,
        }),
      );
    });

    it('should handle various natural language variations', async () => {
      const variations = [
        { input: 'Open a new consensus topic', expected: {} },
        { input: 'Create topic with memo "My memo"', expected: { topicMemo: 'My memo' } },
        { input: 'Create topic and set submit key', expected: { isSubmitKey: true } },
        { input: 'Create topic with transaction memo "TX: memo"', expected: { transactionMemo: 'TX: memo' } },
      ];

      const hederaAPI = toolkit.getHederaAgentKitAPI();

      for (const variation of variations) {
        const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue(''); //spies on the run method of the HederaAgentKitAPI and stops it from executing
        await agentExecutor.invoke({ input: variation.input });
        expect(spy).toHaveBeenCalledOnce();
        expect(spy).toHaveBeenCalledWith(
          CREATE_TOPIC_TOOL,
          expect.objectContaining(variation.expected),
        );
        spy.mockRestore();
      }
    });
  });

  describe.skip('Tool Available', () => {
    it('should have create topic tool available', () => {
      const tools = toolkit.getTools();
      const createTopic = tools.find(tool => tool.name === 'create_topic_tool');

      expect(createTopic).toBeDefined();
      expect(createTopic!.name).toBe('create_topic_tool');
      expect(createTopic!.description).toContain('create a new topic');
    });
  });
});
