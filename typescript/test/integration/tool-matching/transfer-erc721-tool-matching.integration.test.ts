import { describe, it, expect, beforeAll, afterEach, vi, afterAll } from 'vitest';
import { AgentExecutor } from 'langchain/agents';
import { HederaLangchainToolkit } from '@/langchain';
import { createLangchainTestSetup, type LangchainTestSetup } from '../../utils';
import { TRANSFER_ERC721_TOOL } from '@/plugins/core-evm-plugin/tools/erc721/transfer-erc721';

describe('Transfer ERC721 Tool Matching Integration Tests', () => {
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
    it('should match simple transfer ERC721 command', async () => {
      const input =
        'Transfer ERC721 token 1 from contract 0.0.5678 from 0.0.1234 to 0x1234567890123456789012345678901234567890';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        TRANSFER_ERC721_TOOL,
        expect.objectContaining({
          contractId: '0.0.5678',
          fromAddress: '0.0.1234',
          toAddress: '0x1234567890123456789012345678901234567890',
          tokenId: 1,
        }),
      );
    });

    it('should match command with Hedera addresses', async () => {
      const input = 'Send ERC721 token 5 from contract 0.0.1234 from 0.0.5678 to account 0.0.9999';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        TRANSFER_ERC721_TOOL,
        expect.objectContaining({
          contractId: '0.0.1234',
          fromAddress: '0.0.5678',
          toAddress: '0.0.9999',
          tokenId: 5,
        }),
      );
    });

    it('should handle command without explicit fromAddress', async () => {
      const input = 'Transfer ERC721 token 3 from contract 0.0.1111 to 0.0.2222';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        TRANSFER_ERC721_TOOL,
        expect.objectContaining({
          contractId: '0.0.1111',
          toAddress: '0.0.2222',
          tokenId: 3,
        }),
      );
    });

    it('should handle various natural language variations', async () => {
      const variations = [
        {
          input: 'Move ERC721 token 2 from contract 0.0.1234 from 0.0.5678 to 0.0.9999',
          expected: {
            contractId: '0.0.1234',
            fromAddress: '0.0.5678',
            toAddress: '0.0.9999',
            tokenId: 2,
          },
        },
        {
          input:
            'Send ERC721 token 0 of contract 0.0.3333 from address 0.0.4444 to address 0.0.5555',
          expected: {
            contractId: '0.0.3333',
            fromAddress: '0.0.4444',
            toAddress: '0.0.5555',
            tokenId: 0,
          },
        },
        {
          input: 'Transfer ERC721 collectible 10 at 0.0.5555 from 0.0.6666 to recipient 0.0.7777',
          expected: {
            contractId: '0.0.5555',
            fromAddress: '0.0.6666',
            toAddress: '0.0.7777',
            tokenId: 10,
          },
        },
      ];

      const hederaAPI = toolkit.getHederaAgentKitAPI();

      for (const variation of variations) {
        const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');
        await agentExecutor.invoke({ input: variation.input });
        expect(spy).toHaveBeenCalledOnce();
        expect(spy).toHaveBeenCalledWith(
          TRANSFER_ERC721_TOOL,
          expect.objectContaining(variation.expected),
        );
        spy.mockRestore();
      }
    });

    it('should handle mixed address formats', async () => {
      const variations = [
        {
          input:
            'Transfer ERC721 token 1 from EVM contract 0x1111111111111111111111111111111111111111 from Hedera 0.0.5678 to EVM 0x2222222222222222222222222222222222222222',
          expected: {
            contractId: '0x1111111111111111111111111111111111111111',
            fromAddress: '0.0.5678',
            toAddress: '0x2222222222222222222222222222222222222222',
            tokenId: 1,
          },
        },
        {
          input:
            'Send NFT 5 from Hedera contract 0.0.1234 from EVM address 0x3333333333333333333333333333333333333333 to Hedera account 0.0.5678',
          expected: {
            contractId: '0.0.1234',
            fromAddress: '0x3333333333333333333333333333333333333333',
            toAddress: '0.0.5678',
            tokenId: 5,
          },
        },
      ];

      const hederaAPI = toolkit.getHederaAgentKitAPI();

      for (const variation of variations) {
        const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');
        await agentExecutor.invoke({ input: variation.input });
        expect(spy).toHaveBeenCalledOnce();
        expect(spy).toHaveBeenCalledWith(
          TRANSFER_ERC721_TOOL,
          expect.objectContaining(variation.expected),
        );
        spy.mockRestore();
      }
    });

    it('should handle large token IDs', async () => {
      const input = 'Transfer ERC721 token 999999 from contract 0.0.1234 from 0.0.5678 to 0.0.9999';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        TRANSFER_ERC721_TOOL,
        expect.objectContaining({
          contractId: '0.0.1234',
          fromAddress: '0.0.5678',
          toAddress: '0.0.9999',
          tokenId: 999999,
        }),
      );
    });

    it('should handle token ID 0', async () => {
      const input = 'Transfer ERC721 token 0 from contract 0.0.1234 to 0.0.5678';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        TRANSFER_ERC721_TOOL,
        expect.objectContaining({
          contractId: '0.0.1234',
          toAddress: '0.0.5678',
          tokenId: 0,
        }),
      );
    });

    it('should match scheduled transaction', async () => {
      const input =
        'Schedule transfer ERC721 token 1 from contract 0.0.5678 from 0.0.1234 to 0x1234567890123456789012345678901234567890. Make it expire tomorrow and wait for its expiration time with executing it.';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        TRANSFER_ERC721_TOOL,
        expect.objectContaining({
          contractId: '0.0.5678',
          fromAddress: '0.0.1234',
          toAddress: '0x1234567890123456789012345678901234567890',
          tokenId: 1,
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
    it('should have transfer ERC721 tool available', () => {
      const tools = toolkit.getTools();
      const transferERC721 = tools.find(tool => tool.name === 'transfer_erc721_tool');

      expect(transferERC721).toBeDefined();
      expect(transferERC721!.name).toBe('transfer_erc721_tool');
      expect(transferERC721!.description).toContain('transfer an existing ERC721 token');
    });
  });
});
