import { describe, it, expect, beforeAll, afterEach, vi, afterAll } from 'vitest';
import { AgentExecutor } from 'langchain/agents';
import { HederaLangchainToolkit } from '@/langchain';
import { createLangchainTestSetup, type LangchainTestSetup } from '../../utils';
import { TRANSFER_ERC20_TOOL } from '@/plugins/core-evm-plugin/tools/erc20/transfer-erc20';

describe('Transfer ERC20 Tool Matching Integration Tests', () => {
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
    it('should match simple transfer ERC20 command', async () => {
      const input =
        'Transfer 100 0.0.5678 ERC20 tokens from contract to 0x1234567890123456789012345678901234567890';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        TRANSFER_ERC20_TOOL,
        expect.objectContaining({
          contractId: '0.0.5678',
          recipientAddress: '0x1234567890123456789012345678901234567890',
          amount: 100,
        }),
      );
    });

    it('should match command with Hedera addresses', async () => {
      const input = 'Send 50 tokens from ERC20 contract 0.0.1234 to account 0.0.5678';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        TRANSFER_ERC20_TOOL,
        expect.objectContaining({
          contractId: '0.0.1234',
          recipientAddress: '0.0.5678',
          amount: 50,
        }),
      );
    });

    it('should handle decimal amounts', async () => {
      const input = 'Transfer 12 ERC20 tokens 0.0.1111 to 0.0.2222';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        TRANSFER_ERC20_TOOL,
        expect.objectContaining({
          contractId: '0.0.1111',
          recipientAddress: '0.0.2222',
          amount: 12,
        }),
      );
    });

    it('should match scheduled transaction', async () => {
      const input =
        'Schedule transfer 100 0.0.5678 ERC20 tokens from contract to 0x1234567890123456789012345678901234567890. Make it expire tomorrow and wait for its expiration time with executing it.';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        TRANSFER_ERC20_TOOL,
        expect.objectContaining({
          contractId: '0.0.5678',
          recipientAddress: '0x1234567890123456789012345678901234567890',
          amount: 100,
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
          input: 'Send 25 erc20 tokens from contract 0.0.1234 to 0.0.5678',
          expected: { contractId: '0.0.1234', recipientAddress: '0.0.5678', amount: 25 },
        },
        {
          input: 'Transfer 75 ERC20 tokens from contract 0.0.1111 to 0.0.2222',
          expected: { contractId: '0.0.1111', recipientAddress: '0.0.2222', amount: 75 },
        },
        {
          input: 'Move 200 erc20 tokens of contract 0.0.3333 to address 0.0.4444',
          expected: { contractId: '0.0.3333', recipientAddress: '0.0.4444', amount: 200 },
        },
        {
          input: 'Send 1000 ERC20 tokens (contract address: 0.0.5555) to recipient 0.0.6666',
          expected: { contractId: '0.0.5555', recipientAddress: '0.0.6666', amount: 1000 },
        },
      ];

      const hederaAPI = toolkit.getHederaAgentKitAPI();

      for (const variation of variations) {
        const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');
        await agentExecutor.invoke({ input: variation.input });
        expect(spy).toHaveBeenCalledOnce();
        expect(spy).toHaveBeenCalledWith(
          TRANSFER_ERC20_TOOL,
          expect.objectContaining(variation.expected),
        );
        spy.mockRestore();
      }
    });

    it('should handle mixed address formats', async () => {
      const variations = [
        {
          input:
            'Transfer 10 tokens from EVM contract 0x1111111111111111111111111111111111111111 to Hedera account 0.0.5678',
          expected: {
            contractId: '0x1111111111111111111111111111111111111111',
            recipientAddress: '0.0.5678',
            amount: 10,
          },
        },
        {
          input:
            'Send 5 ERC20 from Hedera 0.0.1234 to EVM address 0x2222222222222222222222222222222222222222',
          expected: {
            contractId: '0.0.1234',
            recipientAddress: '0x2222222222222222222222222222222222222222',
            amount: 5,
          },
        },
      ];

      const hederaAPI = toolkit.getHederaAgentKitAPI();

      for (const variation of variations) {
        const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');
        await agentExecutor.invoke({ input: variation.input });
        expect(spy).toHaveBeenCalledOnce();
        expect(spy).toHaveBeenCalledWith(
          TRANSFER_ERC20_TOOL,
          expect.objectContaining(variation.expected),
        );
        spy.mockRestore();
      }
    });

    it('should handle large amounts', async () => {
      const input = 'Transfer 1000000 ERC20 tokens from contract 0.0.1234 to 0.0.5678';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        TRANSFER_ERC20_TOOL,
        expect.objectContaining({
          contractId: '0.0.1234',
          recipientAddress: '0.0.5678',
          amount: 1000000,
        }),
      );
    });
  });

  describe.skip('Tool Available', () => {
    it('should have transfer ERC20 tool available', () => {
      const tools = toolkit.getTools();
      const transferERC20 = tools.find(tool => tool.name === 'transfer_erc20_tool');

      expect(transferERC20).toBeDefined();
      expect(transferERC20!.name).toBe('transfer_erc20_tool');
      expect(transferERC20!.description).toContain(
        'transfer a given amount of an existing ERC20 token',
      );
    });
  });
});
