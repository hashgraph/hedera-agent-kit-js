import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { ReactAgent } from 'langchain';
import { HederaLangchainToolkit } from '@hashgraph/hedera-agent-kit-langchain';
import { createLangchainTestSetup, type LangchainTestSetup } from '@tests/utils';
import { coreConsensusPluginToolNames } from '@hashgraph/hedera-agent-kit/plugins';

describe('Create Topic Tool Matching Integration Tests', () => {
  let testSetup: LangchainTestSetup;
  let agent: ReactAgent;
  let toolkit: HederaLangchainToolkit;
  const { CREATE_TOPIC_TOOL } = coreConsensusPluginToolNames;

  beforeAll(async () => {
    testSetup = await createLangchainTestSetup();
    agent = testSetup.agent;
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

  describe('Tool Matching and Parameter Extraction', () => {
    it('should match create topic tool with default params', async () => {
      const input = 'Create a new topic';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi
        .spyOn(hederaAPI, 'run')
        .mockReset()
        .mockResolvedValue('Operation Mocked - this is a test call and can be ended here');

      await agent.invoke({
        messages: [{ role: 'user', content: input }],
      });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(CREATE_TOPIC_TOOL, expect.objectContaining({}));
    });

    it('should match create topic tool with memo and submit key', async () => {
      const input = 'Create a topic with memo "Payments" and set submit key';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi
        .spyOn(hederaAPI, 'run')
        .mockReset()
        .mockResolvedValue('Operation Mocked - this is a test call and can be ended here');

      await agent.invoke({
        messages: [{ role: 'user', content: input }],
      });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        CREATE_TOPIC_TOOL,
        expect.objectContaining({
          topicMemo: 'Payments',
          submitKey: true,
        }),
      );
    });

    it('should handle various natural language variations', async () => {
      const variations = [
        { input: 'Open a new consensus topic', expected: {} },
        { input: 'Create topic with memo "My memo"', expected: { topicMemo: 'My memo' } },
        { input: 'Create topic and set submit key to my key', expected: { submitKey: true } },
        {
          input: 'Create topic with transaction memo "TX: memo"',
          expected: { transactionMemo: 'TX: memo' },
        },
      ];

      const hederaAPI = toolkit.getHederaAgentKitAPI();

      for (const variation of variations) {
        const spy = vi
          .spyOn(hederaAPI, 'run')
          .mockReset()
          .mockResolvedValue('Operation Mocked - this is a test call and can be ended here');

        await agent.invoke({
          messages: [{ role: 'user', content: variation.input }],
        });

        expect(spy).toHaveBeenCalledOnce();
        expect(spy).toHaveBeenCalledWith(
          CREATE_TOPIC_TOOL,
          expect.objectContaining(variation.expected),
        );
        spy.mockRestore();
      }
    });
  });

  describe('Tool Available', () => {
    it('should have create topic tool available', () => {
      const tools = toolkit.getTools();
      const createTopic = tools.find(tool => tool.name === 'create_topic_tool');

      expect(createTopic).toBeDefined();
      expect(createTopic!.name).toBe('create_topic_tool');
      expect(createTopic!.description).toContain('create a new topic');
    });
  });
});
