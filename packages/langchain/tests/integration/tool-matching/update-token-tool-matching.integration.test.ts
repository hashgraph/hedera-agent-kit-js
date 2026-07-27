import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { ReactAgent } from 'langchain';
import { HederaLangchainToolkit } from '@hashgraph/hedera-agent-kit-langchain';
import { createLangchainTestSetup, type LangchainTestSetup } from '@tests/utils';
import { coreTokenPluginToolNames } from '@hashgraph/hedera-agent-kit/plugins';

/**
 * The LLM may express "use operator key" as boolean true, string "true", or even
 * the operator account ID from the context snippet. All forms are valid inputs —
 * normaliseUpdateToken handles the conversion. These helpers make assertions
 * resilient to that non-determinism.
 */
const isOperatorKeyIntent = (v: unknown): boolean =>
  v === true ||
  v === 'true' ||
  (typeof v === 'string' && /^\d+\.\d+\.\d+$/.test(v));

const isDisableKeyIntent = (v: unknown): boolean => v === false || v === 'false';

describe('Update Token Tool Matching Integration Tests', () => {
  let testSetup: LangchainTestSetup;
  let agent: ReactAgent;
  let toolkit: HederaLangchainToolkit;

  const { UPDATE_TOKEN_TOOL } = coreTokenPluginToolNames;

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
    it('should match update token tool with token name and symbol update', async () => {
      const input = 'Update token 0.0.1001 name to "NewName" and symbol to "NNT"';

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
        UPDATE_TOKEN_TOOL,
        expect.objectContaining({ tokenId: '0.0.1001', tokenName: 'NewName', tokenSymbol: 'NNT' }),
      );
    });

    it('should match update token tool with treasury account update', async () => {
      const input = 'Change the treasury account of token 0.0.2002 to 0.0.3003';

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
        UPDATE_TOKEN_TOOL,
        expect.objectContaining({ tokenId: '0.0.2002', treasuryAccountId: '0.0.3003' }),
      );
    });

    it('should handle adminKey set to true (operator key)', async () => {
      const input = 'Set the admin key for token 0.0.4004 to my key';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi
        .spyOn(hederaAPI, 'run')
        .mockReset()
        .mockResolvedValue('Operation Mocked - this is a test call and can be ended here');

      await agent.invoke({
        messages: [{ role: 'user', content: input }],
      });

      expect(spy).toHaveBeenCalledOnce();
      const [tool3, params3] = spy.mock.calls[0];
      expect(tool3).toBe(UPDATE_TOKEN_TOOL);
      expect(params3.tokenId).toBe('0.0.4004');
      expect(isOperatorKeyIntent(params3.adminKey)).toBe(true);
    });

    it('should handle supplyKey set to a specific public key string', async () => {
      const specificKey =
        '302a300506032b6570032100e470123c5359a60714ee8f6e917d52a78f219156dd0a997d4c82b0e6c8e3e4a2';
      const input = `Update the supply key for token 0.0.5005 to ${specificKey}`;

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
        UPDATE_TOKEN_TOOL,
        expect.objectContaining({ tokenId: '0.0.5005', supplyKey: specificKey }),
      );
    });

    it('should handle multiple key updates including setting to false (removing a key)', async () => {
      const input =
        'For token 0.0.6006, set kycKey to true, disable the freezeKey and update the token memo to "Test Token"';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi
        .spyOn(hederaAPI, 'run')
        .mockReset()
        .mockResolvedValue('Operation Mocked - this is a test call and can be ended here');

      await agent.invoke({
        messages: [{ role: 'user', content: input }],
      });

      expect(spy).toHaveBeenCalledOnce();
      const [tool5, params5] = spy.mock.calls[0];
      expect(tool5).toBe(UPDATE_TOKEN_TOOL);
      expect(params5.tokenId).toBe('0.0.6006');
      expect(isOperatorKeyIntent(params5.kycKey)).toBe(true);
      expect(isDisableKeyIntent(params5.freezeKey)).toBe(true);
      expect(params5.tokenMemo).toBe('Test Token');
    });

    it('should handle metadata update', async () => {
      const metadataValue = '{"description":"new metadata"}';
      const input = `Update the metadata for token 0.0.7007 to '${metadataValue}'`;

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
        const spy = vi
          .spyOn(hederaAPI, 'run')
          .mockReset()
          .mockResolvedValue('Operation Mocked - this is a test call and can be ended here');
        await agent.invoke({
          messages: [{ role: 'user', content: variation.input }],
        });
        expect(spy).toHaveBeenCalledOnce();
        const [calledTool, calledParams] = spy.mock.calls[0];
        expect(calledTool).toBe(UPDATE_TOKEN_TOOL);
        // Check non-key fields with objectContaining; key-boolean fields need flexible matching.
        const { pauseKey, kycKey, freezeKey, adminKey, supplyKey, wipeKey, feeScheduleKey, metadataKey, ...rest } = variation.expected as any;
        expect(calledParams).toMatchObject(rest);
        if (pauseKey !== undefined)       expect(pauseKey === true ? isOperatorKeyIntent(calledParams.pauseKey) : isDisableKeyIntent(calledParams.pauseKey)).toBe(true);
        if (adminKey !== undefined)       expect(adminKey === true ? isOperatorKeyIntent(calledParams.adminKey) : isDisableKeyIntent(calledParams.adminKey)).toBe(true);
        if (kycKey !== undefined)         expect(kycKey === true ? isOperatorKeyIntent(calledParams.kycKey) : isDisableKeyIntent(calledParams.kycKey)).toBe(true);
        if (freezeKey !== undefined)      expect(freezeKey === true ? isOperatorKeyIntent(calledParams.freezeKey) : isDisableKeyIntent(calledParams.freezeKey)).toBe(true);
        if (supplyKey !== undefined)      expect(supplyKey === true ? isOperatorKeyIntent(calledParams.supplyKey) : isDisableKeyIntent(calledParams.supplyKey)).toBe(true);
        if (wipeKey !== undefined)        expect(wipeKey === true ? isOperatorKeyIntent(calledParams.wipeKey) : isDisableKeyIntent(calledParams.wipeKey)).toBe(true);
        if (feeScheduleKey !== undefined) expect(feeScheduleKey === true ? isOperatorKeyIntent(calledParams.feeScheduleKey) : isDisableKeyIntent(calledParams.feeScheduleKey)).toBe(true);
        if (metadataKey !== undefined)    expect(metadataKey === true ? isOperatorKeyIntent(calledParams.metadataKey) : isDisableKeyIntent(calledParams.metadataKey)).toBe(true);
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
