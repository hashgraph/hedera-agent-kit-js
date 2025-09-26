import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { AgentExecutor } from 'langchain/agents';
import { HederaLangchainToolkit } from '@/langchain';
import { createLangchainTestSetup, type LangchainTestSetup } from '../../utils';
import { coreAccountPluginToolNames } from '@/plugins';

/**
 * Tool-matching integration tests verify that natural language inputs
 * are mapped to the correct tool with correctly extracted parameters.
 */

describe.skip('Approve HBAR Allowance Tool Matching Integration Tests', () => {
  let testSetup: LangchainTestSetup;
  let agentExecutor: AgentExecutor;
  let toolkit: HederaLangchainToolkit;
  const { APPROVE_HBAR_ALLOWANCE_TOOL } = coreAccountPluginToolNames;

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
    it('matches approve HBAR allowance with explicit owner, spender, and integer amount', async () => {
      const input = 'Approve 1 HBAR allowance from 0.0.1001 to spender 0.0.2002';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        APPROVE_HBAR_ALLOWANCE_TOOL,
        expect.objectContaining({
          ownerAccountId: '0.0.1001',
          spenderAccountId: '0.0.2002',
          amount: 1,
        }),
      );
    });

    it('matches approve HBAR allowance with decimal amount and memo', async () => {
      const input = 'Approve 0.25 HBAR allowance to 0.0.3333 with memo "gift"';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        APPROVE_HBAR_ALLOWANCE_TOOL,
        expect.objectContaining({
          spenderAccountId: '0.0.3333',
          amount: 0.25,
          transactionMemo: 'gift',
        }),
      );
    });

    it('matches approve HBAR allowance using implicit owner from context (owner omitted)', async () => {
      const input = 'Approve 0.75 HBAR allowance to 0.0.4444';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      // Do not assert ownerAccountId as it may be injected later from context; just ensure spender and amount parsed
      expect(spy).toHaveBeenCalledWith(
        APPROVE_HBAR_ALLOWANCE_TOOL,
        expect.objectContaining({
          spenderAccountId: '0.0.4444',
          amount: 0.75,
        }),
      );
    });

    it('handles various natural language variations', async () => {
      const variations = [
        {
          input: 'Give spending allowance of 1.5 HBAR to 0.0.5555',
          expected: { spenderAccountId: '0.0.5555', amount: 1.5 },
        },
        {
          input: 'Authorize 0.01 HBAR for spender 0.0.6666',
          expected: { spenderAccountId: '0.0.6666', amount: 0.01 },
        },
        {
          input: 'Approve HBAR allowance of 2 to account 0.0.7777 with memo "ops budget"',
          expected: { spenderAccountId: '0.0.7777', amount: 2, transactionMemo: 'ops budget' },
        },
      ];

      const hederaAPI = toolkit.getHederaAgentKitAPI();

      for (const v of variations) {
        const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');
        await agentExecutor.invoke({ input: v.input });
        expect(spy).toHaveBeenCalledOnce();
        expect(spy).toHaveBeenCalledWith(
          APPROVE_HBAR_ALLOWANCE_TOOL,
          expect.objectContaining(v.expected as any),
        );
        spy.mockRestore();
      }
    });
  });

  describe('Tool Available', () => {
    it('has approve hbar allowance tool available', () => {
      const tools = toolkit.getTools();
      const tool = tools.find(t => t.name === 'approve_hbar_allowance_tool');

      expect(tool).toBeDefined();
      expect(tool!.name).toBe('approve_hbar_allowance_tool');
      expect(tool!.description).toContain('approves an HBAR allowance');
    });
  });
});
