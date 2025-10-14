import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { AgentExecutor } from 'langchain/agents';
import { HederaLangchainToolkit } from '@/langchain';
import { createLangchainTestSetup, type LangchainTestSetup } from '../../utils';
import { coreTokenPluginToolNames } from '@/plugins';

describe('Mint Fungible Token Tool Matching Integration Tests', () => {
  let testSetup: LangchainTestSetup;
  let agentExecutor: AgentExecutor;
  let toolkit: HederaLangchainToolkit;
  const { MINT_FUNGIBLE_TOKEN_TOOL } = coreTokenPluginToolNames;

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
    it('should match mint fungible token tool with minimal params', async () => {
      const input = 'Mint 10 of token 0.0.12345';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        MINT_FUNGIBLE_TOKEN_TOOL,
        expect.objectContaining({
          tokenId: '0.0.12345',
          amount: 10,
        }),
      );
    });

    it('should extract scheduling parameters when provided', async () => {
      const input =
        'Schedule mint 10 of token 0.0.12345. Make it expire tomorrow and wait for its expiration time with executing it.';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        MINT_FUNGIBLE_TOKEN_TOOL,
        expect.objectContaining({
          tokenId: '0.0.12345',
          amount: 10,
          schedulingParams: expect.objectContaining({
            adminKey: false,
            isScheduled: true,
            expirationTime: expect.any(String),
            waitForExpiry: true,
          }),
        }),
      );
    });

    it('should parse natural language variations of minting', async () => {
      const variations = [
        {
          input: 'Mint 100 tokens of 0.0.56789',
          expected: { tokenId: '0.0.56789', amount: 100 },
        },
        {
          input: 'Add 50 supply to fungible token 0.0.22222',
          expected: { tokenId: '0.0.22222', amount: 50 },
        },
        {
          input: 'Increase supply of token 0.0.99999 by 200',
          expected: { tokenId: '0.0.99999', amount: 200 },
        },
      ];

      const hederaAPI = toolkit.getHederaAgentKitAPI();

      for (const variation of variations) {
        const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');
        await agentExecutor.invoke({ input: variation.input });

        expect(spy).toHaveBeenCalledOnce();
        expect(spy).toHaveBeenCalledWith(
          MINT_FUNGIBLE_TOKEN_TOOL,
          expect.objectContaining(variation.expected),
        );

        spy.mockRestore();
      }
    }, 120_000); // increase timeout to 2 minutes
  });

  describe.skip('Tool Available', () => {
    it('should have mint fungible token tool available', () => {
      const tools = toolkit.getTools();
      const mintFT = tools.find(tool => tool.name === 'mint_fungible_token_tool');

      expect(mintFT).toBeDefined();
      expect(mintFT!.name).toBe('mint_fungible_token_tool');
      expect(mintFT!.description).toContain('mint a given amount');
    });
  });
});
