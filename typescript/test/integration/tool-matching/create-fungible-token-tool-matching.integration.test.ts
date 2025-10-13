import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { AgentExecutor } from 'langchain/agents';
import { HederaLangchainToolkit } from '@/langchain';
import { createLangchainTestSetup, type LangchainTestSetup } from '../../utils';
import { coreTokenPluginToolNames } from '@/plugins';

describe('Create Fungible Token Tool Matching Integration Tests', () => {
  let testSetup: LangchainTestSetup;
  let agentExecutor: AgentExecutor;
  let toolkit: HederaLangchainToolkit;
  const { CREATE_FUNGIBLE_TOKEN_TOOL } = coreTokenPluginToolNames;

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
    it('should match create fungible token tool with minimal params', async () => {
      const input = 'Create a new fungible token called MyToken with symbol MTK';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        CREATE_FUNGIBLE_TOKEN_TOOL,
        expect.objectContaining({
          tokenName: 'MyToken',
          tokenSymbol: 'MTK',
        }),
      );
    });

    it('should match with initial supply, decimals, and supply type', async () => {
      const input =
        'Create a fungible token named GoldCoin with symbol GOLD, initial supply 1000, decimals 2, and finite supply';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        CREATE_FUNGIBLE_TOKEN_TOOL,
        expect.objectContaining({
          tokenName: 'GoldCoin',
          tokenSymbol: 'GOLD',
          initialSupply: 1000,
          decimals: 2,
          supplyType: 'finite',
        }),
      );
    });

    it('should match with treasury account and supply key', async () => {
      const input =
        'Create a fungible token MySupplyToken with symbol SUP, treasury account 0.0.5005 and set supply key';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        CREATE_FUNGIBLE_TOKEN_TOOL,
        expect.objectContaining({
          tokenName: 'MySupplyToken',
          tokenSymbol: 'SUP',
          treasuryAccountId: '0.0.5005',
          isSupplyKey: true,
        }),
      );
    });

    it('should handle various natural language variations', async () => {
      const variations = [
        // { input: 'Create a fungible token', expected: {} },
        {
          input: 'Make a fungible token named TestToken with symbol TST',
          expected: { tokenName: 'TestToken', tokenSymbol: 'TST' },
        },
        {
          input: 'Create fungible token MTK, MyToken, with initial supply 50000',
          expected: { initialSupply: 50000 },
        },
        {
          input: 'Create fungible GLD, Gold, token with infinite supply',
          expected: { supplyType: 'infinite' },
        },
      ];

      const hederaAPI = toolkit.getHederaAgentKitAPI();

      for (const variation of variations) {
        const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');
        await agentExecutor.invoke({ input: variation.input });
        expect(spy).toHaveBeenCalledOnce();
        expect(spy).toHaveBeenCalledWith(
          CREATE_FUNGIBLE_TOKEN_TOOL,
          expect.objectContaining(variation.expected),
        );
        spy.mockRestore();
      }
    });

    it('should extract scheduling parameters when provided', async () => {
      const input =
        'Schedule create fungible token transaction called MyToken with symbol MTK. Make it expire tomorrow and wait for its expiration time with executing it.';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        CREATE_FUNGIBLE_TOKEN_TOOL,
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
  });

  describe('Tool Available', () => {
    it('should have create fungible token tool available', () => {
      const tools = toolkit.getTools();
      const createFT = tools.find(tool => tool.name === 'create_fungible_token_tool');

      expect(createFT).toBeDefined();
      expect(createFT!.name).toBe('create_fungible_token_tool');
      expect(createFT!.description).toContain('fungible token on Hedera');
    });
  });
});
