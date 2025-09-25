import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { AgentExecutor } from 'langchain/agents';
import { HederaLangchainToolkit } from '@/langchain';
import { createLangchainTestSetup, type LangchainTestSetup } from '../../utils';
import { DISSOCIATE_TOKEN_TOOL } from '@/plugins/core-token-plugin/tools/dissociate-token';

describe.skip('Dissociate Token Tool Matching Integration Tests', () => {
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
    it('should match dissociate token tool with a single tokenId', async () => {
      const input = 'Dissociate token 0.0.12345 from my account';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue(''); // prevent actual execution

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        DISSOCIATE_TOKEN_TOOL,
        expect.objectContaining({ tokenIds: ['0.0.12345'] }),
      );
    });

    it('should match dissociate token tool with multiple tokenIds and explicit accountId', async () => {
      const input = 'Dissociate tokens 0.0.1111 and 0.0.2222 from account 0.0.3333';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        DISSOCIATE_TOKEN_TOOL,
        expect.objectContaining({
          tokenIds: ['0.0.1111', '0.0.2222'],
          accountId: '0.0.3333',
        }),
      );
    });

    it('should handle natural language variations', async () => {
      const variations = [
        { input: 'Remove token 0.0.42 from my account', expected: { tokenIds: ['0.0.42'] } },
        {
          input: 'Dissociate tokens 0.0.77 and 0.0.88 from account 0.0.99',
          expected: { tokenIds: ['0.0.77', '0.0.88'], accountId: '0.0.99' },
        },
      ];

      const hederaAPI = toolkit.getHederaAgentKitAPI();

      for (const variation of variations) {
        const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');
        await agentExecutor.invoke({ input: variation.input });
        expect(spy).toHaveBeenCalledOnce();
        expect(spy).toHaveBeenCalledWith(
          DISSOCIATE_TOKEN_TOOL,
          expect.objectContaining(variation.expected),
        );
        spy.mockRestore();
      }
    });
  });

  describe.skip('Tool Available', () => {
    it('should have dissociate token tool available in the toolkit', () => {
      const tools = toolkit.getTools();
      const dissociateTool = tools.find(tool => tool.name === DISSOCIATE_TOKEN_TOOL);

      expect(dissociateTool).toBeDefined();
      expect(dissociateTool!.name).toBe(DISSOCIATE_TOKEN_TOOL);
      expect(dissociateTool!.description).toContain('This tool will airdrop a fungible token');
    });
  });
});
