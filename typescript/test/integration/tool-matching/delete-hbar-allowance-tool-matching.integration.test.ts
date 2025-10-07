import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { AgentExecutor } from 'langchain/agents';
import { HederaLangchainToolkit } from '@/langchain';
import { createLangchainTestSetup, type LangchainTestSetup } from '../../utils';
import { coreAccountPluginToolNames } from '@/plugins';

/**
 * Tool-matching integration tests verify that natural language inputs
 * are mapped to the correct tool with correctly extracted parameters.
 */

describe('Delete HBAR Allowance Tool Matching Integration Tests', () => {
  let testSetup: LangchainTestSetup;
  let agentExecutor: AgentExecutor;
  let toolkit: HederaLangchainToolkit;
  const { DELETE_HBAR_ALLOWANCE_TOOL } = coreAccountPluginToolNames;

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
    it('matches delete HBAR allowance with explicit owner and spender', async () => {
      const input = 'Delete HBAR allowance from 0.0.1001 to 0.0.2002';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        DELETE_HBAR_ALLOWANCE_TOOL,
        expect.objectContaining({
          ownerAccountId: '0.0.1001',
          spenderAccountId: '0.0.2002',
        }),
      );
    });

    it('matches delete HBAR allowance with memo included', async () => {
      const input = 'Revoke HBAR allowance to 0.0.3333 with memo "cleanup"';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        DELETE_HBAR_ALLOWANCE_TOOL,
        expect.objectContaining({
          spenderAccountId: '0.0.3333',
          transactionMemo: 'cleanup',
        }),
      );
    });

    it('defaults to implicit owner when not provided', async () => {
      const input = 'Remove HBAR allowance for spender 0.0.4444';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      // no explicit ownerAccountId expected
      expect(spy).toHaveBeenCalledWith(
        DELETE_HBAR_ALLOWANCE_TOOL,
        expect.objectContaining({
          spenderAccountId: '0.0.4444',
        }),
      );
    });

    it('handles various natural language variations', async () => {
      const variations = [
        {
          input: 'Revoke allowance for HBAR spending given to 0.0.5555',
          expected: { spenderAccountId: '0.0.5555' },
        },
        {
          input: 'Delete HBAR allowance for account 0.0.6666 with memo "expired"',
          expected: { spenderAccountId: '0.0.6666', transactionMemo: 'expired' },
        },
        {
          input: 'Remove HBAR allowance from account 0.0.7777 given to spender 0.0.8888',
          expected: { ownerAccountId: '0.0.7777', spenderAccountId: '0.0.8888' },
        },
      ];

      const hederaAPI = toolkit.getHederaAgentKitAPI();

      for (const v of variations) {
        const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');
        await agentExecutor.invoke({ input: v.input });
        expect(spy).toHaveBeenCalledOnce();
        expect(spy).toHaveBeenCalledWith(
          DELETE_HBAR_ALLOWANCE_TOOL,
          expect.objectContaining(v.expected as any),
        );
        spy.mockRestore();
      }
    });
  });

  describe('Tool Available', () => {
    it('has delete hbar allowance tool available', () => {
      const tools = toolkit.getTools();
      const tool = tools.find(t => t.name === 'delete_hbar_allowance_tool');

      expect(tool).toBeDefined();
      expect(tool!.name).toBe('delete_hbar_allowance_tool');
      expect(tool!.description).toContain('deletes an HBAR allowance');
    });
  });
});
