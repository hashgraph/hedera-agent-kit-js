import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { AgentExecutor } from 'langchain/agents';
import { HederaLangchainToolkit } from '@/langchain';
import { createLangchainTestSetup, type LangchainTestSetup } from '../../utils';
import { coreAccountPluginToolNames } from '@/plugins';

describe.skip('Schedule Delete Tool Matching Integration Tests', () => {
  let testSetup: LangchainTestSetup;
  let agentExecutor: AgentExecutor;
  let toolkit: HederaLangchainToolkit;
  const { SCHEDULE_DELETE_TOOL } = coreAccountPluginToolNames;

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
    it('should match schedule delete tool for simple delete request', async () => {
      const input = 'Delete the scheduled transaction with ID 0.0.123456';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        SCHEDULE_DELETE_TOOL,
        expect.objectContaining({
          scheduleId: '0.0.123456',
        }),
      );
    });

    it('should match schedule delete tool with different wording', async () => {
      const input = 'Cancel scheduled transaction 0.0.789012';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        SCHEDULE_DELETE_TOOL,
        expect.objectContaining({
          scheduleId: '0.0.789012',
        }),
      );
    });

    it('should match schedule delete tool with "abort" wording', async () => {
      const input = 'Abort the scheduled transaction with ID 0.0.901234';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        SCHEDULE_DELETE_TOOL,
        expect.objectContaining({
          scheduleId: '0.0.901234',
        }),
      );
    });

    it('should extract correct parameters for complex delete request', async () => {
      const input = 'Please delete the scheduled transaction with ID 0.0.123456789 immediately';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        SCHEDULE_DELETE_TOOL,
        expect.objectContaining({
          scheduleId: '0.0.123456789',
        }),
      );
    });
  });

  describe.skip('Tool Available', () => {
    it('should have schedule delete tool available', () => {
      const tools = toolkit.getTools();
      const tool = tools.find(t => t.name === 'schedule_delete_tool');

      expect(tool).toBeDefined();
      expect(tool!.name).toBe('schedule_delete_tool');
      expect(tool!.description).toContain('delete a scheduled transaction');
    });
  });
});


