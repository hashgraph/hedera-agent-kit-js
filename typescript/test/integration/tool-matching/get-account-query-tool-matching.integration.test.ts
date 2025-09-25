import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { AgentExecutor } from 'langchain/agents';
import { HederaLangchainToolkit } from '@/langchain';
import { createLangchainTestSetup, type LangchainTestSetup } from '../../utils';
import { GET_ACCOUNT_QUERY_TOOL } from '@/plugins/core-account-query-plugin/tools/queries/get-account-query';

describe.skip('Get Account Query Tool Matching Integration Tests', () => {
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
    it('should match get account query tool for simple request', async () => {
      const input = 'Get account info for 0.0.1234';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue(''); //spies on the run method of the HederaAgentKitAPI and stops it from executing

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        GET_ACCOUNT_QUERY_TOOL,
        expect.objectContaining({
          accountId: '0.0.1234',
        }),
      );
    });

    it('should match when user says "query" instead of "get"', async () => {
      const input = 'Query details of account 0.0.5555';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue(''); //spies on the run method of the HederaAgentKitAPI and stops it from executing

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        GET_ACCOUNT_QUERY_TOOL,
        expect.objectContaining({
          accountId: '0.0.5555',
        }),
      );
    });

    it('should handle various natural language variations', async () => {
      const variations = [
        { input: 'Please show me details for account 0.0.2222', accountId: '0.0.2222' },
        { input: 'Look up account 0.0.3333', accountId: '0.0.3333' },
        { input: 'Tell me about 0.0.4444', accountId: '0.0.4444' },
      ];

      const hederaAPI = toolkit.getHederaAgentKitAPI();

      for (const variation of variations) {
        const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue(''); //spies on the run method of the HederaAgentKitAPI and stops it from executing
        await agentExecutor.invoke({ input: variation.input });

        expect(spy).toHaveBeenCalledOnce();
        expect(spy).toHaveBeenCalledWith(
          GET_ACCOUNT_QUERY_TOOL,
          expect.objectContaining({
            accountId: variation.accountId,
          }),
        );
        spy.mockRestore();
      }
    });
  });

  describe.skip('Tool Available', () => {
    it('should have get account query tool available', () => {
      const tools = toolkit.getTools();
      const accountQueryTool = tools.find(tool => tool.name === 'get_account_query_tool');

      expect(accountQueryTool).toBeDefined();
      expect(accountQueryTool!.name).toBe('get_account_query_tool');
      expect(accountQueryTool!.description).toContain('account information');
    });
  });
});
