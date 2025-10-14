import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { AgentExecutor } from 'langchain/agents';
import { HederaLangchainToolkit } from '@/langchain';
import { createLangchainTestSetup, type LangchainTestSetup } from '../../utils';
import { coreTokenPluginToolNames } from '@/plugins';

describe('Create Non-Fungible Token Tool Matching Integration Tests', () => {
  let testSetup: LangchainTestSetup;
  let agentExecutor: AgentExecutor;
  let toolkit: HederaLangchainToolkit;
  const { CREATE_NON_FUNGIBLE_TOKEN_TOOL } = coreTokenPluginToolNames;

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
    it('should match create non-fungible token tool with minimal params', async () => {
      const input = 'Create a new non-fungible token called MyNFT with symbol MNFT';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        CREATE_NON_FUNGIBLE_TOKEN_TOOL,
        expect.objectContaining({
          tokenName: 'MyNFT',
          tokenSymbol: 'MNFT',
        }),
      );
    });

    it('should match with max supply parameter', async () => {
      const input =
        'Create a non-fungible token named ArtCollection with symbol ART and max supply 500';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        CREATE_NON_FUNGIBLE_TOKEN_TOOL,
        expect.objectContaining({
          tokenName: 'ArtCollection',
          tokenSymbol: 'ART',
          maxSupply: 500,
        }),
      );
    });

    it('should match with treasury account parameter', async () => {
      const input = 'Create an NFT GameItems with symbol GAME, treasury account 0.0.5005';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        CREATE_NON_FUNGIBLE_TOKEN_TOOL,
        expect.objectContaining({
          tokenName: 'GameItems',
          tokenSymbol: 'GAME',
          treasuryAccountId: '0.0.5005',
        }),
      );
    });

    it('should extract scheduling parameters when provided', async () => {
      const input =
        'Schedule create non-fungible token transaction called MyToken with symbol MTK. Make it expire tomorrow and wait for its expiration time with executing it.';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        CREATE_NON_FUNGIBLE_TOKEN_TOOL,
        expect.objectContaining({
          tokenName: 'MyToken',
          tokenSymbol: 'MTK',
          schedulingParams: expect.objectContaining({
            adminKey: false,
            isScheduled: true,
            expirationTime: expect.any(String),
            waitForExpiry: true,
          }),
        }),
      );
    });

    it('should handle various natural language variations', async () => {
      const variations = [
        {
          input: 'Make an NFT named CollectibleCard with symbol CARD',
          expected: { tokenName: 'CollectibleCard', tokenSymbol: 'CARD' },
        },
        {
          input: 'Create non-fungible token RARE, RareItems, with maximum supply 10',
          expected: { maxSupply: 10 },
        },
        {
          input: 'Generate NFT collection called DigitalArt symbol DA max supply 1000',
          expected: { tokenName: 'DigitalArt', tokenSymbol: 'DA', maxSupply: 1000 },
        },
      ];

      const hederaAPI = toolkit.getHederaAgentKitAPI();

      for (const variation of variations) {
        const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');
        await agentExecutor.invoke({ input: variation.input });
        expect(spy).toHaveBeenCalledOnce();
        expect(spy).toHaveBeenCalledWith(
          CREATE_NON_FUNGIBLE_TOKEN_TOOL,
          expect.objectContaining(variation.expected),
        );
        spy.mockRestore();
      }
    });
  });

  describe('Tool Available', () => {
    it('should have create non-fungible token tool available', () => {
      const tools = toolkit.getTools();
      const createNFT = tools.find(tool => tool.name === 'create_non_fungible_token_tool');

      expect(createNFT).toBeDefined();
      expect(createNFT!.name).toBe('create_non_fungible_token_tool');
      expect(createNFT!.description).toContain('non-fungible token (NFT) on Hedera');
    });
  });
});
