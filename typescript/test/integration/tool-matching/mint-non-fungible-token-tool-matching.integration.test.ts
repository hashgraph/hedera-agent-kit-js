import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest';
import { AgentExecutor } from 'langchain/agents';
import { HederaLangchainToolkit } from '@/langchain';
import { createLangchainTestSetup, type LangchainTestSetup } from '../../utils';
import { coreTokenPluginToolNames } from '@/plugins';

describe('Mint Non-Fungible Token Tool Matching Integration Tests', () => {
  let testSetup: LangchainTestSetup;
  let agentExecutor: AgentExecutor;
  let toolkit: HederaLangchainToolkit;
  const { MINT_NON_FUNGIBLE_TOKEN_TOOL } = coreTokenPluginToolNames;

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
    it('should match mint NFT tool with single URI', async () => {
      const input =
        'Mint 0.0.5005 with metadata: ipfs://bafyreiao6ajgsfji6qsgbqwdtjdu5gmul7tv2v3pd6kjgcw5o65b2ogst4/metadata.json';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        MINT_NON_FUNGIBLE_TOKEN_TOOL,
        expect.objectContaining({
          tokenId: '0.0.5005',
          uris: [
            'ipfs://bafyreiao6ajgsfji6qsgbqwdtjdu5gmul7tv2v3pd6kjgcw5o65b2ogst4/metadata.json',
          ],
        }),
      );
    });

    it('should match mint NFT tool with multiple URIs', async () => {
      const input =
        'Mint NFTs for token 0.0.6006 with metadata URIs: ipfs://uri1, ipfs://uri2, ipfs://uri3';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        MINT_NON_FUNGIBLE_TOKEN_TOOL,
        expect.objectContaining({
          tokenId: '0.0.6006',
          uris: ['ipfs://uri1', 'ipfs://uri2', 'ipfs://uri3'],
        }),
      );
    });

    it('should extract scheduling parameters when provided', async () => {
      const input =
        'Schedule Mint 0.0.5005 with metadata: ipfs://bafyreiao6ajgsfji6qsgbqwdtjdu5gmul7tv2v3pd6kjgcw5o65b2ogst4/metadata.json. Make it expire tomorrow and wait for its expiration time with executing it.';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        MINT_NON_FUNGIBLE_TOKEN_TOOL,
        expect.objectContaining({
          tokenId: '0.0.5005',
          uris: [
            'ipfs://bafyreiao6ajgsfji6qsgbqwdtjdu5gmul7tv2v3pd6kjgcw5o65b2ogst4/metadata.json',
          ],
          schedulingParams: expect.objectContaining({
            adminKey: false,
            isScheduled: true,
            expirationTime: expect.any(String),
            waitForExpiry: true,
          }),
        }),
      );
    });

    it('should handle slight natural language variations', async () => {
      const variations = [
        {
          input: 'Mint NFT 0.0.7007 with metadata ipfs://abc123',
          expected: { tokenId: '0.0.7007', uris: ['ipfs://abc123'] },
        },
        {
          input: 'Mint NFTs 0.0.8008 with metadata URIs ipfs://meta1 and ipfs://meta2',
          expected: { tokenId: '0.0.8008', uris: ['ipfs://meta1', 'ipfs://meta2'] },
        },
      ];

      const hederaAPI = toolkit.getHederaAgentKitAPI();

      for (const variation of variations) {
        const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');
        await agentExecutor.invoke({ input: variation.input });

        expect(spy).toHaveBeenCalledOnce();
        expect(spy).toHaveBeenCalledWith(
          MINT_NON_FUNGIBLE_TOKEN_TOOL,
          expect.objectContaining(variation.expected),
        );
        spy.mockRestore();
      }
    });
  });

  describe.skip('Tool Available', () => {
    it('should have mint non-fungible token tool available', () => {
      const tools = toolkit.getTools();
      const mintNFT = tools.find(tool => tool.name === 'mint_non_fungible_token_tool');

      expect(mintNFT).toBeDefined();
      expect(mintNFT!.name).toBe('mint_non_fungible_token_tool');
      expect(mintNFT!.description).toContain('mint NFTs with its unique metadata');
    });
  });
});
