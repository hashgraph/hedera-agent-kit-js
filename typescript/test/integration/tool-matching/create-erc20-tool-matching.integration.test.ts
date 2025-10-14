import { describe, it, expect, beforeAll, afterEach, vi, afterAll } from 'vitest';
import { AgentExecutor } from 'langchain/agents';
import { HederaLangchainToolkit } from '@/langchain';
import { createLangchainTestSetup, type LangchainTestSetup } from '../../utils';
import { CREATE_ERC20_TOOL } from '@/plugins/core-evm-plugin/tools/erc20/create-erc20';

describe('Create ERC20 Tool Matching Integration Tests', () => {
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
    it('should match simple create ERC20 command', async () => {
      const input = 'Create an ERC20 token named TestToken with symbol TST and 1000 initial supply';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        CREATE_ERC20_TOOL,
        expect.objectContaining({
          tokenName: 'TestToken',
          tokenSymbol: 'TST',
          initialSupply: 1000,
        }),
      );
    });

    it('should match command with explicit decimals', async () => {
      const input =
        'Deploy ERC20 token called MyCoin with symbol MC, 500 initial supply, and 8 decimals';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        CREATE_ERC20_TOOL,
        expect.objectContaining({
          tokenName: 'MyCoin',
          tokenSymbol: 'MC',
          initialSupply: 500,
          decimals: 8,
        }),
      );
    });

    it('should handle minimal input with defaults', async () => {
      const input = 'Create ERC20 token SampleCoin with symbol SC';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        CREATE_ERC20_TOOL,
        expect.objectContaining({
          tokenName: 'SampleCoin',
          tokenSymbol: 'SC',
        }),
      );
    });

    it('should handle various natural language variations', async () => {
      const variations = [
        {
          input: 'Deploy a new ERC20 called Alpha with symbol ALP',
          expected: { tokenName: 'Alpha', tokenSymbol: 'ALP' },
        },
        {
          input: 'Create token Alpha (symbol ALP) as ERC20',
          expected: { tokenName: 'Alpha', tokenSymbol: 'ALP' },
        },
        {
          input: 'Launch ERC20 token Alpha ticker ALP',
          expected: { tokenName: 'Alpha', tokenSymbol: 'ALP' },
        },
      ];

      const hederaAPI = toolkit.getHederaAgentKitAPI();

      for (const variation of variations) {
        const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');
        await agentExecutor.invoke({ input: variation.input });
        expect(spy).toHaveBeenCalledOnce();
        expect(spy).toHaveBeenCalledWith(
          CREATE_ERC20_TOOL,
          expect.objectContaining(variation.expected),
        );
        spy.mockRestore();
      }
    });

    it('should match scheduled transaction', async () => {
      const input =
        'Schedule deploy ERC20 token called MyCoin with symbol MC, 500 initial supply, and 8 decimals. Make it expire tomorrow and wait for its expiration time with executing it.';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        CREATE_ERC20_TOOL,
        expect.objectContaining({
          tokenName: 'MyCoin',
          tokenSymbol: 'MC',
          initialSupply: 500,
          decimals: 8,
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
    it('should have create ERC20 tool available', () => {
      const tools = toolkit.getTools();
      const createERC20 = tools.find(tool => tool.name === 'create_erc20_tool');

      expect(createERC20).toBeDefined();
      expect(createERC20!.name).toBe('create_erc20_tool');
      expect(createERC20!.description).toContain('ERC20 token on Hedera');
    });
  });
});
