import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { AgentExecutor } from 'langchain/agents';
import { HederaLangchainToolkit } from '@/langchain';
import { createLangchainTestSetup, type LangchainTestSetup } from '../../utils';
import { coreAccountPluginToolNames } from '@/plugins';

describe('Update Account Tool Matching Integration Tests', () => {
  let testSetup: LangchainTestSetup;
  let agentExecutor: AgentExecutor;
  let toolkit: HederaLangchainToolkit;

  const { UPDATE_ACCOUNT_TOOL } = coreAccountPluginToolNames;

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
    it('should match update account tool with memo update', async () => {
      const input = 'Update account 0.0.1234 memo to "Updated Memo"';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        UPDATE_ACCOUNT_TOOL,
        expect.objectContaining({ accountId: '0.0.1234', accountMemo: 'Updated Memo' }),
      );
    });

    it('should match update account tool with max associations and decline reward', async () => {
      const input =
        'Set max automatic token associations to 5 and decline staking rewards for my account';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        UPDATE_ACCOUNT_TOOL,
        expect.objectContaining({
          maxAutomaticTokenAssociations: 5,
          declineStakingReward: expect.any(Boolean),
        }),
      );
    });

    it('should handle stakedAccountId updates', async () => {
      const input = 'Update the account 0.0.9 to stake to 0.0.10';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        UPDATE_ACCOUNT_TOOL,
        expect.objectContaining({ accountId: '0.0.9', stakedAccountId: '0.0.10' }),
      );
    });

    it('should extract scheduling parameters when provided', async () => {
      const input =
        'Schedule an account update for account 0.0.1234. Set the account memo to "updated with scheduled transaction". Make it expire tomorrow and wait for its expiration time with executing it.';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        UPDATE_ACCOUNT_TOOL,
        expect.objectContaining({
          accountId: '0.0.1234',
          accountMemo: 'updated with scheduled transaction',
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
          input: 'Change memo for account 0.0.42 to "Ops Account"',
          expected: { accountId: '0.0.42', accountMemo: 'Ops Account' },
        },
        {
          input: 'For my account set max associations to 3',
          expected: { maxAutomaticTokenAssociations: 3 },
        },
      ];

      const hederaAPI = toolkit.getHederaAgentKitAPI();

      for (const variation of variations) {
        const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');
        await agentExecutor.invoke({ input: variation.input });
        expect(spy).toHaveBeenCalledOnce();
        expect(spy).toHaveBeenCalledWith(
          UPDATE_ACCOUNT_TOOL,
          expect.objectContaining(variation.expected),
        );
        spy.mockRestore();
      }
    });
  });

  describe('Tool Available', () => {
    it('should have update account tool available', () => {
      const tools = toolkit.getTools();
      const updateAccount = tools.find(tool => tool.name === 'update_account_tool');

      expect(updateAccount).toBeDefined();
      expect(updateAccount!.name).toBe('update_account_tool');
      expect(updateAccount!.description).toContain('update an existing Hedera account');
    });
  });
});
