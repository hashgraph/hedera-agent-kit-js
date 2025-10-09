import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { AgentExecutor } from 'langchain/agents';
import { HederaLangchainToolkit } from '@/langchain';
import { createLangchainTestSetup, type LangchainTestSetup } from '../../utils';
import { coreAccountPluginToolNames } from '@/plugins';

/**
 * Tool-matching tests for APPROVE_TOKEN_ALLOWANCE_TOOL to ensure
 * natural language inputs map to the correct tool with proper params.
 */

describe('Approve Token Allowance Tool Matching Integration Tests', () => {
  let testSetup: LangchainTestSetup;
  let agentExecutor: AgentExecutor;
  let toolkit: HederaLangchainToolkit;
  const { APPROVE_TOKEN_ALLOWANCE_TOOL } = coreAccountPluginToolNames;

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
    it('matches approve token allowance with owner, spender, and one token allowance', async () => {
      const input = 'Approve allowance of 100 for token 0.0.7777 from 0.0.1001 to spender 0.0.2002';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        APPROVE_TOKEN_ALLOWANCE_TOOL,
        expect.objectContaining({
          ownerAccountId: '0.0.1001',
          spenderAccountId: '0.0.2002',
          tokenApprovals: [expect.objectContaining({ tokenId: '0.0.7777', amount: 100 })],
        }),
      );
    });

    it('matches approve token allowance with implicit owner and memo', async () => {
      const input = 'Authorize 2 tokens of 0.0.8888 for spender 0.0.3333, memo "marketing"';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        APPROVE_TOKEN_ALLOWANCE_TOOL,
        expect.objectContaining({
          spenderAccountId: '0.0.3333',
          tokenApprovals: [expect.objectContaining({ tokenId: '0.0.8888', amount: 2 })],
          transactionMemo: 'marketing',
        }),
      );
    });

    it('matches multiple token allowances', async () => {
      const input =
        'Approve 1 token of token ID 0.0.1, 2 tokens of token ID 0.0.2, and 3 tokens of token ID 0.0.3 for spender with account id 0.0.4444';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        APPROVE_TOKEN_ALLOWANCE_TOOL,
        expect.objectContaining({
          spenderAccountId: '0.0.4444',
          tokenApprovals: [
            expect.objectContaining({ tokenId: '0.0.1', amount: 1 }),
            expect.objectContaining({ tokenId: '0.0.2', amount: 2 }),
            expect.objectContaining({ tokenId: '0.0.3', amount: 3 }),
          ],
        }),
      );
    });
  });

  describe('Tool Available', () => {
    it('has approve token allowance tool available', () => {
      const tools = toolkit.getTools();
      const tool = tools.find(t => t.name === 'approve_token_allowance_tool');
      expect(tool).toBeDefined();
      expect(tool!.name).toBe('approve_token_allowance_tool');
      expect(tool!.description).toContain('approves allowances for one or more fungible tokens');
    });
  });
});
