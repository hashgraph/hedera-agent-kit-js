import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { AgentExecutor } from 'langchain/agents';
import { HederaLangchainToolkit } from '@/langchain';
import { createLangchainTestSetup, type LangchainTestSetup } from '../../utils';
import { coreTokenPlugin, coreTokenPluginToolNames } from '@/plugins';
import { AgentMode } from '@/shared/configuration';

/**
 * Tool-matching integration tests verify that natural language inputs
 * are mapped to the correct tool with correctly extracted parameters.
 */

describe('Approve NFT Allowance Tool Matching Integration Tests', () => {
  let testSetup: LangchainTestSetup;
  let agentExecutor: AgentExecutor;
  let toolkit: HederaLangchainToolkit;
  const { APPROVE_NFT_ALLOWANCE_TOOL } = coreTokenPluginToolNames;

  beforeAll(async () => {
    // Use a minimal toolkit with only the target tool to make LLM routing deterministic
    testSetup = await createLangchainTestSetup({
      tools: [APPROVE_NFT_ALLOWANCE_TOOL],
      plugins: [coreTokenPlugin],
      agentMode: AgentMode.AUTONOMOUS,
    } as any);
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
    it('matches approve NFT allowance with explicit owner, single serial and memo', async () => {
      const input =
        "Approve NFT allowance for token 0.0.5005 serial 1 to spender 0.0.7007 from 0.0.6006 with memo 'gift'";

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        APPROVE_NFT_ALLOWANCE_TOOL,
        expect.objectContaining({
          ownerAccountId: '0.0.6006',
          spenderAccountId: '0.0.7007',
          tokenId: '0.0.5005',
          serialNumbers: [1],
          transactionMemo: 'gift',
        }),
      );
    });

    it('matches approve NFT allowance using implicit owner (omitted) for multiple serials', async () => {
      const input = 'Approve NFT allowance for token 0.0.1111 serials 2 and 3 to 0.0.2222';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        APPROVE_NFT_ALLOWANCE_TOOL,
        expect.objectContaining({
          spenderAccountId: '0.0.2222',
          tokenId: '0.0.1111',
          serialNumbers: [2, 3],
        }),
      );
    });

    it('handles comma-separated serial numbers and alternate phrasing', async () => {
      const variations = [
        {
          input: 'Authorize NFT allowance on 0.0.3333 for serials 5, 6, 7 to account 0.0.4444',
          expected: { tokenId: '0.0.3333', spenderAccountId: '0.0.4444', serialNumbers: [5, 6, 7] },
        },
        {
          input: 'Give spending approval of NFTs token 0.0.8888 serial 9 to 0.0.9999',
          expected: { tokenId: '0.0.8888', spenderAccountId: '0.0.9999', serialNumbers: [9] },
        },
        {
          input:
            'Approve allowance for NFT token 0.0.1234 serials 10 and 12 for spender 0.0.4321 with memo "ops"',
          expected: {
            tokenId: '0.0.1234',
            spenderAccountId: '0.0.4321',
            serialNumbers: [10, 12],
            transactionMemo: 'ops',
          },
        },
      ];

      const hederaAPI = toolkit.getHederaAgentKitAPI();

      for (const v of variations) {
        const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');
        await agentExecutor.invoke({ input: v.input });
        expect(spy).toHaveBeenCalledOnce();
        expect(spy).toHaveBeenCalledWith(
          APPROVE_NFT_ALLOWANCE_TOOL,
          expect.objectContaining(v.expected as any),
        );
        spy.mockRestore();
      }
    });
  });

  describe('Approve-all (allSerials) parameter extraction', () => {
    it('matches requests to approve for all serials (entire collection) with allSerials=true and no serialNumbers', async () => {
      const variations = [
        {
          input: 'Approve NFT allowance for all serials of token 0.0.5555 to spender 0.0.6666',
          tokenId: '0.0.5555',
          spenderAccountId: '0.0.6666',
        },
        {
          input: 'Grant approval for the entire collection token 0.0.1010 to account 0.0.2020',
          tokenId: '0.0.1010',
          spenderAccountId: '0.0.2020',
        },
        {
          input: 'Give spending rights for all NFTs of token 0.0.3030 to 0.0.4040 with memo "bulk"',
          tokenId: '0.0.3030',
          spenderAccountId: '0.0.4040',
          transactionMemo: 'bulk',
        },
      ];

      const hederaAPI = toolkit.getHederaAgentKitAPI();

      for (const v of variations) {
        const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');
        await agentExecutor.invoke({ input: v.input });

        expect(spy).toHaveBeenCalledOnce();
        expect(spy).toHaveBeenCalledWith(
          APPROVE_NFT_ALLOWANCE_TOOL,
          expect.objectContaining({
            tokenId: v.tokenId,
            spenderAccountId: v.spenderAccountId,
            allSerials: true,
            ...(v.transactionMemo ? { transactionMemo: v.transactionMemo } : {}),
          }),
        );
        // Ensure serialNumbers is not set when approving for all
        expect(spy).toHaveBeenCalledWith(
          APPROVE_NFT_ALLOWANCE_TOOL,
          expect.not.objectContaining({ serialNumbers: expect.anything() }),
        );

        spy.mockRestore();
      }
    });

    it('understands alternate phrasing like approve entire NFT collection for a spender', async () => {
      const input = 'Approve the entire NFT collection 0.0.7777 to spender 0.0.8888';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        APPROVE_NFT_ALLOWANCE_TOOL,
        expect.objectContaining({
          allSerials: true,
          tokenId: '0.0.7777',
          spenderAccountId: '0.0.8888',
        }),
      );
      expect(spy).toHaveBeenCalledWith(
        APPROVE_NFT_ALLOWANCE_TOOL,
        expect.not.objectContaining({ serialNumbers: expect.anything() }),
      );

      spy.mockRestore();
    });
  });

  describe('Tool Available', () => {
    it('has approve NFT allowance tool available', () => {
      const tools = toolkit.getTools();
      const tool = tools.find(t => t.name === 'approve_nft_allowance_tool');

      expect(tool).toBeDefined();
      expect(tool!.name).toBe('approve_nft_allowance_tool');
      expect(tool!.description).toContain('approves an NFT allowance');
    });
  });
});
