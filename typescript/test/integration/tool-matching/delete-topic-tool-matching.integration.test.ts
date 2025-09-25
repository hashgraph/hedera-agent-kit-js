import { describe, it, expect, beforeAll, afterEach, vi, afterAll } from 'vitest';
import { AgentExecutor } from 'langchain/agents';
import { HederaLangchainToolkit } from '@/langchain';
import { createLangchainTestSetup, type LangchainTestSetup } from '../../utils';
import { DELETE_TOPIC_TOOL } from '@/plugins/core-consensus-plugin/tools/consensus/delete-topic';

describe.skip('Delete Topic Tool Matching Integration Tests', () => {
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
    if (testSetup) testSetup.cleanup();
  });

  it('should match simple delete topic command', async () => {
    const input = 'Delete topic 0.0.5005';

    const hederaAPI = toolkit.getHederaAgentKitAPI();
    console.log(JSON.stringify(hederaAPI.tools, null, 2));
    const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

    const resp = await agentExecutor.invoke({ input });
    console.log(JSON.stringify(resp, null, 2));

    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith(
      DELETE_TOPIC_TOOL,
      expect.objectContaining({
        topicId: '0.0.5005',
      }),
    );
  });

  it('should match natural variations', async () => {
    const variations = [
      { input: 'Remove topic 0.0.6006', expected: { topicId: '0.0.6006' } },
      { input: 'Delete the Hedera topic 0.0.7007', expected: { topicId: '0.0.7007' } },
    ];

    const hederaAPI = toolkit.getHederaAgentKitAPI();
    for (const v of variations) {
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');
      await agentExecutor.invoke({ input: v.input });
      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(DELETE_TOPIC_TOOL, expect.objectContaining(v.expected));
      spy.mockRestore();
    }
  });

  it('tool is available', () => {
    const tools = toolkit.getTools();
    const tool = tools.find(t => t.name === 'delete_topic_tool');
    expect(tool).toBeDefined();
    expect(tool!.description).toContain('delete a given Hedera network topic');
  });
});
