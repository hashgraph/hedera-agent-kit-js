import { describe, it, expect, beforeAll, afterEach, vi, afterAll } from 'vitest';
import { AgentExecutor } from 'langchain/agents';
import { HederaLangchainToolkit } from '@/langchain';
import { createLangchainTestSetup, type LangchainTestSetup } from '../../utils';
import { MINT_ERC721_TOOL } from '@/plugins/core-evm-plugin/tools/erc721/mint-erc721';

describe('Mint ERC721 Tool Matching Integration Tests', () => {
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

  describe('Tool Matching and Parameter Extraction', () => {
    it('should match simple mint ERC721 command with EVM address', async () => {
      const input = 'Mint ERC721 token 0.0.5678 to 0x1234567890123456789012345678901234567890';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        MINT_ERC721_TOOL,
        expect.objectContaining({
          contractId: '0.0.5678',
          toAddress: '0x1234567890123456789012345678901234567890',
        }),
      );
    });

    it('should match mint ERC721 command with Hedera address', async () => {
      const input = 'Mint an NFT from contract 0.0.1234 to 0.0.5678';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        MINT_ERC721_TOOL,
        expect.objectContaining({
          contractId: '0.0.1234',
          toAddress: '0.0.5678',
        }),
      );
    });

    it('should handle minimal input (default to context account)', async () => {
      const input = 'Mint an EVM compatible NFT token from contract 0.0.1111';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        MINT_ERC721_TOOL,
        expect.objectContaining({
          contractId: '0.0.1111',
        }),
      );
    });

    it('should handle natural language variations', async () => {
      const variations = [
        {
          input: 'Mint ERC NFT from 0.0.2222 to 0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
          expected: {
            contractId: '0.0.2222',
            toAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
          },
        },
        {
          input: 'Create NFT (ERC-721) token from contract 0.0.3333 to 0.0.4444',
          expected: { contractId: '0.0.3333', toAddress: '0.0.4444' },
        },
      ];

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      for (const variation of variations) {
        const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');
        await agentExecutor.invoke({ input: variation.input });
        expect(spy).toHaveBeenCalledOnce();
        expect(spy).toHaveBeenCalledWith(
          MINT_ERC721_TOOL,
          expect.objectContaining(variation.expected),
        );
        spy.mockRestore();
      }
    });

    it('should match scheduled transaction', async () => {
      const input =
        'Schedule mint ERC721 token 0.0.5678 to 0x1234567890123456789012345678901234567890. Make it expire tomorrow and wait for its expiration time with executing it.';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        MINT_ERC721_TOOL,
        expect.objectContaining({
          contractId: '0.0.5678',
          toAddress: '0x1234567890123456789012345678901234567890',
          schedulingParams: expect.objectContaining({
            adminKey: false,
            isScheduled: true,
            expirationTime: expect.any(String),
            waitForExpiry: true,
          }),
        }),
      );
    });
  });

  describe.skip('Tool Available', () => {
    it('should have mint ERC721 tool available', () => {
      const tools = toolkit.getTools();
      const mintERC721 = tools.find(tool => tool.name === 'mint_erc721_tool');

      expect(mintERC721).toBeDefined();
      expect(mintERC721!.name).toBe('mint_erc721_tool');
      expect(mintERC721!.description).toContain('mint a new ERC721 token');
    });
  });
});
