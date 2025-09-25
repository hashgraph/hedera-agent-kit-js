import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { AgentExecutor } from 'langchain/agents';
import { HederaLangchainToolkit } from '@/langchain';
import { createLangchainTestSetup, type LangchainTestSetup } from '../../utils';
import { coreAccountPluginToolNames } from '@/plugins';

describe.skip('Delete Account Tool Matching Integration Tests', () => {
  let testSetup: LangchainTestSetup;
  let agentExecutor: AgentExecutor;
  let toolkit: HederaLangchainToolkit;
  const { DELETE_ACCOUNT_TOOL } = coreAccountPluginToolNames;

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
    it('should match delete account tool with accountId only', async () => {
      const input = 'Delete account 0.0.12345';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue(''); //spies on the run method of the HederaAgentKitAPI and stops it from executing

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        DELETE_ACCOUNT_TOOL,
        expect.objectContaining({ accountId: '0.0.12345' }),
      );
    });

    it('should match delete account tool with transferAccountId', async () => {
      const input = 'Delete the account 0.0.1111 and transfer funds to 0.0.2222';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue(''); //spies on the run method of the HederaAgentKitAPI and stops it from executing

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        DELETE_ACCOUNT_TOOL,
        expect.objectContaining({ accountId: '0.0.1111', transferAccountId: '0.0.2222' }),
      );
    });

    it('should handle various natural language variations', async () => {
      const variations = [
        { input: 'Close account 0.0.42', expected: { accountId: '0.0.42' } },
        {
          input: 'Remove account id 0.0.77 and send balance to 0.0.88',
          expected: { accountId: '0.0.77', transferAccountId: '0.0.88' },
        },
      ];

      const hederaAPI = toolkit.getHederaAgentKitAPI();

      for (const variation of variations) {
        const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue(''); //spies on the run method of the HederaAgentKitAPI and stops it from executing
        await agentExecutor.invoke({ input: variation.input });
        expect(spy).toHaveBeenCalledOnce();
        expect(spy).toHaveBeenCalledWith(
          DELETE_ACCOUNT_TOOL,
          expect.objectContaining(variation.expected),
        );
        spy.mockRestore();
      }
    });
  });

  describe.skip('Tool Available', () => {
    it('should have delete account tool available', () => {
      const tools = toolkit.getTools();
      const deleteAccount = tools.find(tool => tool.name === 'delete_account_tool');

      expect(deleteAccount).toBeDefined();
      expect(deleteAccount!.name).toBe('delete_account_tool');
      expect(deleteAccount!.description).toContain('delete an existing Hedera account');
    });
  });
});
