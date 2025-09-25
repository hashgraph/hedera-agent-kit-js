import { describe, it, expect, beforeAll, afterAll, afterEach, vi, beforeEach } from 'vitest';
import { AgentExecutor } from 'langchain/agents';
import { HederaLangchainToolkit } from '@/langchain';
import { createLangchainTestSetup, type LangchainTestSetup } from '../../utils';
import { coreTokenPluginToolNames } from '@/plugins';

describe.skip('Airdrop Fungible Token Tool Matching Integration Tests', () => {
  let testSetup: LangchainTestSetup;
  let agentExecutor: AgentExecutor;
  let toolkit: HederaLangchainToolkit;
  const { AIRDROP_FUNGIBLE_TOKEN_TOOL } = coreTokenPluginToolNames;

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
    it('should match airdrop tool with minimal params', async () => {
      const input = 'Airdrop 10 HTS tokens 0.0.1234 from 0.0.1001 to 0.0.2002';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        AIRDROP_FUNGIBLE_TOKEN_TOOL,
        expect.objectContaining({
          tokenId: '0.0.1234',
          sourceAccountId: '0.0.1001',
          recipients: expect.arrayContaining([
            expect.objectContaining({
              accountId: '0.0.2002',
              amount: 10,
            }),
          ]),
        }),
      );
    });

    it('should support multiple recipients', async () => {
      const input = 'Airdrop 5 of token 0.0.9999 from 0.0.1111 to 0.0.2222 and 0.0.3333';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledTimes(1);

      expect(spy).toHaveBeenCalledWith(
        AIRDROP_FUNGIBLE_TOKEN_TOOL,
        expect.objectContaining({
          tokenId: '0.0.9999',
          sourceAccountId: '0.0.1111',
          recipients: expect.arrayContaining([
            expect.objectContaining({ accountId: '0.0.2222', amount: 5 }),
            expect.objectContaining({ accountId: '0.0.3333', amount: 5 }),
          ]),
        }),
      );
    });

    it('should handle natural language variations', async () => {
      const variations = [
        {
          input: 'Airdrop 20 HTS tokens with id 0.0.5555 from 0.0.1010 to 0.0.2020',
          expected: {
            tokenId: '0.0.5555',
            sourceAccountId: '0.0.1010',
            recipients: [{ accountId: '0.0.2020', amount: 20 }],
          },
        },
        {
          input: 'Distribute 15 HTS tokens 0.0.7777 to 0.0.3001 and 0.0.3002 from 0.0.1500',
          expected: {
            tokenId: '0.0.7777',
            sourceAccountId: '0.0.1500',
            recipients: [
              { accountId: '0.0.3001', amount: 15 },
              { accountId: '0.0.3002', amount: 15 },
            ],
          },
        },
      ];

      const hederaAPI = toolkit.getHederaAgentKitAPI();

      for (const variation of variations) {
        const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');
        await agentExecutor.invoke({ input: variation.input });
        expect(spy).toHaveBeenCalledOnce();
        expect(spy).toHaveBeenCalledWith(
          AIRDROP_FUNGIBLE_TOKEN_TOOL,
          expect.objectContaining({
            tokenId: variation.expected.tokenId,
            sourceAccountId: variation.expected.sourceAccountId,
            recipients: expect.arrayContaining(
              variation.expected.recipients.map(r => expect.objectContaining(r)),
            ),
          }),
        );
        spy.mockRestore();
      }
    });
  });

  describe.skip('Tool Availability', () => {
    it('should have airdrop fungible token tool available', () => {
      const tools = toolkit.getTools();
      const airdropTool = tools.find(tool => tool.name === 'airdrop_fungible_token_tool');

      expect(airdropTool).toBeDefined();
      expect(airdropTool!.description).toContain('airdrop a fungible token on Hedera');
    });
  });
});
