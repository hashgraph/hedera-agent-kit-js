import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { ReactAgent } from 'langchain';
import { HederaLangchainToolkit } from '@/langchain';
import { createLangchainTestSetup, type LangchainTestSetup } from '../../utils';
import { coreTokenPluginToolNames } from '@/plugins';

describe('Associate Token Tool Matching Integration Tests', () => {
  let testSetup: LangchainTestSetup;
  let agent: ReactAgent;
  let toolkit: HederaLangchainToolkit;
  const { ASSOCIATE_TOKEN_TOOL } = coreTokenPluginToolNames as any;

  beforeAll(async () => {
    testSetup = await createLangchainTestSetup();
    agent = testSetup.agent;
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
    it('should match associate token tool with minimal params', async () => {
      const input = 'Associate token 0.0.12345 to my account';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi
        .spyOn(hederaAPI, 'run')
        .mockReset()
        .mockResolvedValue('Operation Mocked - this is a test call and can be ended here');

      await agent.invoke({
        messages: [{ role: 'user', content: input }],
      });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        ASSOCIATE_TOKEN_TOOL,
        expect.objectContaining({
          tokenIds: expect.arrayContaining(['0.0.12345']),
        }),
      );
    });

    it('should parse various natural language variations', async () => {
      const variations = [
        {
          input: 'Associate tokens 0.0.11111 and 0.0.22222 with account 0.0.9999',
          expected: { accountId: '0.0.9999', tokenIds: ['0.0.11111', '0.0.22222'] },
        },
        {
          input: 'Link token 0.0.33333 to account 0.0.4444',
          expected: { accountId: '0.0.4444', tokenIds: ['0.0.33333'] },
        },
      ];

      const hederaAPI = toolkit.getHederaAgentKitAPI();

      for (const variation of variations) {
        const spy = vi
          .spyOn(hederaAPI, 'run')
          .mockReset()
          .mockResolvedValue('Operation Mocked - this is a test call and can be ended here');
        await agent.invoke({
          messages: [{ role: 'user', content: variation.input }],
        });

        expect(spy).toHaveBeenCalledOnce();
        expect(spy).toHaveBeenCalledWith(
          ASSOCIATE_TOKEN_TOOL,
          expect.objectContaining({
            tokenIds: expect.arrayContaining(variation.expected.tokenIds),
          }),
        );

        spy.mockRestore();
      }
    }, 120_000);
  });

  describe('Tool Available', () => {
    it('should have associate token tool available', () => {
      const tools = toolkit.getTools();
      const associate = tools.find(tool => tool.name === 'associate_token_tool');

      expect(associate).toBeDefined();
      expect(associate!.name).toBe('associate_token_tool');
      expect(associate!.description).toContain('associate one or more tokens');
    });
  });
});
