import { describe, it, expect, beforeAll, afterEach, vi, afterAll } from 'vitest';
import { AgentExecutor } from 'langchain/agents';
import { HederaLangchainToolkit } from '@/langchain';
import { createLangchainTestSetup, type LangchainTestSetup } from '../../utils';
import { CREATE_ERC721_TOOL } from '@/plugins/core-evm-plugin/tools/erc721/create-erc721';

describe('Create ERC721 Tool Matching Integration Tests', () => {
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
    it('should match simple create ERC721 command', async () => {
      const input =
        'Create an ERC721 token named ArtCollection with symbol ART and base URI https://example.com/metadata/';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        CREATE_ERC721_TOOL,
        expect.objectContaining({
          tokenName: 'ArtCollection',
          tokenSymbol: 'ART',
          baseURI: 'https://example.com/metadata/',
        }),
      );
    });

    it('should match command without baseURI', async () => {
      const input = 'Deploy ERC721 token called MyNFT with symbol MNFT';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        CREATE_ERC721_TOOL,
        expect.objectContaining({
          tokenName: 'MyNFT',
          tokenSymbol: 'MNFT',
        }),
      );
    });

    it('should handle minimal input with defaults', async () => {
      const input = 'Create ERC721 token GameItems with symbol GAME';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        CREATE_ERC721_TOOL,
        expect.objectContaining({
          tokenName: 'GameItems',
          tokenSymbol: 'GAME',
        }),
      );
    });

    it('should handle various natural language variations', async () => {
      const variations = [
        {
          input: 'Deploy a new ERC721 called CryptoArt with symbol CA',
          expected: { tokenName: 'CryptoArt', tokenSymbol: 'CA' },
        },
        {
          input: 'Create NFT collection CryptoArt (symbol CA) as ERC721',
          expected: { tokenName: 'CryptoArt', tokenSymbol: 'CA' },
        },
        {
          input: 'Launch ERC721 NFT collection CryptoArt ticker CA',
          expected: { tokenName: 'CryptoArt', tokenSymbol: 'CA' },
        },
        {
          input: 'Create ERC721 collectible CryptoArt with CA symbol',
          expected: { tokenName: 'CryptoArt', tokenSymbol: 'CA' },
        },
      ];

      const hederaAPI = toolkit.getHederaAgentKitAPI();

      for (const variation of variations) {
        const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');
        await agentExecutor.invoke({ input: variation.input });
        expect(spy).toHaveBeenCalledOnce();
        expect(spy).toHaveBeenCalledWith(
          CREATE_ERC721_TOOL,
          expect.objectContaining(variation.expected),
        );
        spy.mockRestore();
      }
    });

    it('should extract baseURI from various formats', async () => {
      const variations = [
        {
          input:
            'Create ERC721 ArtNFT symbol ART with metadata URI https://api.example.com/metadata/',
          expected: {
            tokenName: 'ArtNFT',
            tokenSymbol: 'ART',
            baseURI: 'https://api.example.com/metadata/',
          },
        },
        {
          input: 'Deploy ERC721 GameItems GAME with base URI https://game.com/items/',
          expected: {
            tokenName: 'GameItems',
            tokenSymbol: 'GAME',
            baseURI: 'https://game.com/items/',
          },
        },
      ];

      const hederaAPI = toolkit.getHederaAgentKitAPI();

      for (const variation of variations) {
        const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');
        await agentExecutor.invoke({ input: variation.input });
        expect(spy).toHaveBeenCalledOnce();
        expect(spy).toHaveBeenCalledWith(
          CREATE_ERC721_TOOL,
          expect.objectContaining(variation.expected),
        );
        spy.mockRestore();
      }
    });

    it('should match scheduled transaction', async () => {
      const input =
        'Schedule deploy ERC721 token called MyNFT with symbol MNFT. Make it expire tomorrow and wait for its expiration time with executing it.';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        CREATE_ERC721_TOOL,
        expect.objectContaining({
          tokenName: 'MyNFT',
          tokenSymbol: 'MNFT',
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
    it('should have create ERC721 tool available', () => {
      const tools = toolkit.getTools();
      const createERC721 = tools.find(tool => tool.name === 'create_erc721_tool');

      expect(createERC721).toBeDefined();
      expect(createERC721!.name).toBe('create_erc721_tool');
      expect(createERC721!.description).toContain('ERC721 token on Hedera');
    });
  });
});
