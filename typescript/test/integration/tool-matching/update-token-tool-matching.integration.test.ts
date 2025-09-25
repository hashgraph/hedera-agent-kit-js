import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { AgentExecutor } from 'langchain/agents';
import { HederaLangchainToolkit } from '@/langchain';
import { createLangchainTestSetup, type LangchainTestSetup } from '../../utils';
import { coreTokenPluginToolNames } from '@/plugins';

describe.skip('Update Token Tool Matching Integration Tests', () => {
  let testSetup: LangchainTestSetup;
  let agentExecutor: AgentExecutor;
  let toolkit: HederaLangchainToolkit;

  const { UPDATE_TOKEN_TOOL } = coreTokenPluginToolNames;

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
    it('should match update token tool with token name and symbol update', async () => {
      const input = 'Update token 0.0.1001 name to "NewName" and symbol to "NNT"';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        UPDATE_TOKEN_TOOL,
        expect.objectContaining({ tokenId: '0.0.1001', tokenName: 'NewName', tokenSymbol: 'NNT' }),
      );
    });

    it('should match update token tool with treasury account update', async () => {
      const input = 'Change the treasury account of token 0.0.2002 to 0.0.3003';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        UPDATE_TOKEN_TOOL,
        expect.objectContaining({ tokenId: '0.0.2002', treasuryAccountId: '0.0.3003' }),
      );
    });

    it('should handle adminKey set to true (operator key)', async () => {
      const input = 'Set the admin key for token 0.0.4004 to my key';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        UPDATE_TOKEN_TOOL,
        expect.objectContaining({ tokenId: '0.0.4004', adminKey: true }),
      );
    });

    it('should handle supplyKey set to a specific public key string', async () => {
      const specificKey =
        '302a300506032b6570032100e470123c5359a60714ee8f6e917d52a78f219156dd0a997d4c82b0e6c8e3e4a2';
      const input = `Update the supply key for token 0.0.5005 to ${specificKey}`;

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        UPDATE_TOKEN_TOOL,
        expect.objectContaining({ tokenId: '0.0.5005', supplyKey: specificKey }),
      );
    });

    it('should handle multiple key updates including setting to false (removing a key)', async () => {
      const input =
        'For token 0.0.6006, set kycKey to true, disable the freezeKey and update the token memo to "Test Token"';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        UPDATE_TOKEN_TOOL,
        expect.objectContaining({
          tokenId: '0.0.6006',
          kycKey: true,
          freezeKey: false,
          tokenMemo: 'Test Token',
        }),
      );
    });

    it('should handle metadata update', async () => {
      const metadataValue = '{"description":"new metadata"}';
      const input = `Update the metadata for token 0.0.7007 to '${metadataValue}'`;

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        UPDATE_TOKEN_TOOL,
        expect.objectContaining({
          tokenId: '0.0.7007',
          metadata: metadataValue,
        }),
      );
    });

    it('should handle natural language for various fields', async () => {
      const variations = [
        {
          input: 'Change token 0.0.8008 name to "Revised Token"',
          expected: { tokenId: '0.0.8008', tokenName: 'Revised Token' },
        },
        {
          input: 'Set the pause key for token 0.0.8009 to my operator key',
          expected: { tokenId: '0.0.8009', pauseKey: true },
        },
        {
          input:
            'Update the fee schedule key of 0.0.8010 to this: 302a300506032b657003210088888888889999999999aaaaaaaaaabbbbbbbbbbbbccccccccccccdddddddddddd',
          expected: {
            tokenId: '0.0.8010',
            feeScheduleKey:
              '302a300506032b657003210088888888889999999999aaaaaaaaaabbbbbbbbbbbbccccccccccccdddddddddddd',
          },
        },
      ];

      const hederaAPI = toolkit.getHederaAgentKitAPI();

      for (const variation of variations) {
        const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');
        await agentExecutor.invoke({ input: variation.input });
        expect(spy).toHaveBeenCalledOnce();
        expect(spy).toHaveBeenCalledWith(
          UPDATE_TOKEN_TOOL,
          expect.objectContaining(variation.expected),
        );
        spy.mockRestore();
      }
    });
  });

  describe('Tool Available', () => {
    it('should have update token tool available', () => {
      const tools = toolkit.getTools();
      const updateToken = tools.find(tool => tool.name === UPDATE_TOKEN_TOOL);

      expect(updateToken).toBeDefined();
      expect(updateToken!.name).toBe(UPDATE_TOKEN_TOOL);
      expect(updateToken!.description).toContain('update an existing Hedera HTS token');
    });
  });
});
