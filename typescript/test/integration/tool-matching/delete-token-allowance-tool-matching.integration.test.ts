import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { AgentExecutor } from 'langchain/agents';
import { HederaLangchainToolkit } from '@/langchain';
import { createLangchainTestSetup, type LangchainTestSetup } from '../../utils';
import { coreAccountPluginToolNames } from '@/plugins';

describe('Delete Token Allowance Tool Matching Integration Tests', () => {
  let testSetup: LangchainTestSetup;
  let agentExecutor: AgentExecutor;
  let toolkit: HederaLangchainToolkit;
  const { DELETE_TOKEN_ALLOWANCE_TOOL } = coreAccountPluginToolNames;

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

  describe('Tool Matching and Parameter Extraction', () => {
    it('matches delete token allowance with explicit owner and spender', async () => {
      const input =
        'Delete token allowance given from 0.0.1001 to account 0.0.2002 for token 0.0.3003';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        DELETE_TOKEN_ALLOWANCE_TOOL,
        expect.objectContaining({
          ownerAccountId: '0.0.1001',
          spenderAccountId: '0.0.2002',
          tokenIds: ['0.0.3003'],
        }),
      );
    });

    it('matches delete token allowance with memo included', async () => {
      const input = 'Delete allowance for account 0.0.4444 for token 0.12345 with memo "cleanup"';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        DELETE_TOKEN_ALLOWANCE_TOOL,
        expect.objectContaining({
          spenderAccountId: '0.0.4444',
          tokenIds: ['0.12345'],
          transactionMemo: 'cleanup',
        }),
      );
    });

    it('defaults to implicit owner when not provided', async () => {
      const input = 'Remove token allowance for spender 0.0.5555 on token 0.0.6666';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        DELETE_TOKEN_ALLOWANCE_TOOL,
        expect.objectContaining({
          spenderAccountId: '0.0.5555',
          tokenIds: ['0.0.6666'],
        }),
      );
    });
  });

  describe('Tool Available', () => {
    it('has delete token allowance tool available', () => {
      const tools = toolkit.getTools();
      const tool = tools.find(t => t.name === 'delete_token_allowance_tool');

      expect(tool).toBeDefined();
      expect(tool!.name).toBe('delete_token_allowance_tool');
      expect(tool!.description).toContain('deletes token allowance');
    });
  });
});
