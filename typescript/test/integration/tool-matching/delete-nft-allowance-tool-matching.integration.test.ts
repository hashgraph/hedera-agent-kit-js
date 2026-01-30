import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { ReactAgent } from 'langchain';
import { HederaLangchainToolkit } from '@/langchain';
import { createLangchainTestSetup, type LangchainTestSetup } from '../../utils';
import { coreTokenPluginToolNames } from '@/plugins';

/**
 * Tool-matching integration tests verify that natural language inputs
 * are mapped to the correct tool with correctly extracted parameters.
 */

describe('Delete NFT Allowance Tool Matching Integration Tests', () => {
  let testSetup: LangchainTestSetup;
  let agent: ReactAgent;
  let toolkit: HederaLangchainToolkit;
  const { DELETE_NFT_ALLOWANCE_TOOL } = coreTokenPluginToolNames;

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
    it('matches delete NFT allowance with explicit owner and single serial', async () => {
      const input = 'Delete NFT allowance for token 0.0.5005 serial 1 from owner 0.0.6006';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockReset().mockResolvedValue('');

      await agent.invoke({
        messages: [{ role: 'user', content: input }],
      });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        DELETE_NFT_ALLOWANCE_TOOL,
        expect.objectContaining({
          ownerAccountId: '0.0.6006',
          tokenId: '0.0.5005',
          serialNumbers: [1],
        }),
      );
    });

    it('matches delete NFT allowance using implicit owner (omitted) for multiple serials', async () => {
      const input = 'Delete NFT allowance for token 0.0.1111 serials 2 and 3';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockReset().mockResolvedValue('');

      await agent.invoke({
        messages: [{ role: 'user', content: input }],
      });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        DELETE_NFT_ALLOWANCE_TOOL,
        expect.objectContaining({
          tokenId: '0.0.1111',
          serialNumbers: [2, 3],
        }),
      );
    });

    it('handles comma-separated serial numbers and alternate phrasing', async () => {
      const variations = [
        {
          input: 'Remove NFT allowance on 0.0.3333 for serials 5, 6, 7',
          expected: { tokenId: '0.0.3333', serialNumbers: [5, 6, 7] },
        },
        {
          input: 'Revoke spending approval of NFTs token 0.0.8888 serial 9',
          expected: { tokenId: '0.0.8888', serialNumbers: [9] },
        },
        {
          input: 'Delete allowance for NFT token 0.0.1234 serials 10 and 12 with memo "cleanup"',
          expected: {
            tokenId: '0.0.1234',
            serialNumbers: [10, 12],
            transactionMemo: 'cleanup',
          },
        },
      ];

      const hederaAPI = toolkit.getHederaAgentKitAPI();

      for (const v of variations) {
        const spy = vi.spyOn(hederaAPI, 'run').mockReset().mockResolvedValue('');
        await agent.invoke({ messages: [{ role: 'user', content: v.input }] });
        expect(spy).toHaveBeenCalledOnce();
        expect(spy).toHaveBeenCalledWith(
          DELETE_NFT_ALLOWANCE_TOOL,
          expect.objectContaining(v.expected as any),
        );
        spy.mockRestore();
      }
    });

    it('matches delete NFT allowance with memo', async () => {
      const input =
        'Delete NFT allowance for token 0.0.7777 serial 5 from owner 0.0.8888 with memo "revoke access"';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockReset().mockResolvedValue('');

      await agent.invoke({
        messages: [{ role: 'user', content: input }],
      });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        DELETE_NFT_ALLOWANCE_TOOL,
        expect.objectContaining({
          ownerAccountId: '0.0.8888',
          tokenId: '0.0.7777',
          serialNumbers: [5],
          transactionMemo: 'revoke access',
        }),
      );
    });
  });

  describe('Tool Available', () => {
    it('has delete NFT allowance tool available', () => {
      const tools = toolkit.getTools();
      const tool = tools.find(t => t.name === 'delete_non_fungible_token_allowance_tool');

      expect(tool).toBeDefined();
      expect(tool!.name).toBe('delete_non_fungible_token_allowance_tool');
      expect(tool!.description).toContain('deletes NFT allowance');
    });
  });
});
