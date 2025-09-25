import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { AgentExecutor } from 'langchain/agents';
import { HederaLangchainToolkit } from '@/langchain';
import { createLangchainTestSetup, type LangchainTestSetup } from '../../utils';
import { coreAccountPluginToolNames } from '@/plugins';

describe.skip('Create Account Tool Matching Integration Tests', () => {
  let testSetup: LangchainTestSetup;
  let agentExecutor: AgentExecutor;
  let toolkit: HederaLangchainToolkit;
  const { CREATE_ACCOUNT_TOOL } = coreAccountPluginToolNames;

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
    it('should match create account tool with default params', async () => {
      const input = 'Create a new Hedera account';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue(''); //spies on the run method of the HederaAgentKitAPI and stops it from executing

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(CREATE_ACCOUNT_TOOL, expect.objectContaining({}));
    });

    it('should match create account tool with memo and initial balance', async () => {
      const input = 'Create an account with memo "Payment account" and initial balance 1.5 HBAR';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue(''); //spies on the run method of the HederaAgentKitAPI and stops it from executing

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        CREATE_ACCOUNT_TOOL,
        expect.objectContaining({
          accountMemo: 'Payment account',
          initialBalance: 1.5,
        }),
      );
    });

    it('should match create account tool with explicit public key', async () => {
      const input = 'Create a new account with public key 302a300506032b6570032100abcdef';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue(''); //spies on the run method of the HederaAgentKitAPI and stops it from executing

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        CREATE_ACCOUNT_TOOL,
        expect.objectContaining({
          publicKey: expect.stringContaining('302a'),
        }),
      );
    });

    it('should parse max automatic token associations', async () => {
      const input = 'Create an account with max automatic token associations 10';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue(''); //spies on the run method of the HederaAgentKitAPI and stops it from executing

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        CREATE_ACCOUNT_TOOL,
        expect.objectContaining({
          maxAutomaticTokenAssociations: 10,
        }),
      );
    });

    it('should handle various natural language variations', async () => {
      const variations = [
        { input: 'Open a new Hedera account', expected: {} },
        { input: 'Create account with memo "My memo"', expected: { accountMemo: 'My memo' } },
        { input: 'Create account funded with 0.01 HBAR', expected: { initialBalance: 0.01 } },
      ];

      const hederaAPI = toolkit.getHederaAgentKitAPI();

      for (const variation of variations) {
        const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue(''); //spies on the run method of the HederaAgentKitAPI and stops it from executing
        await agentExecutor.invoke({ input: variation.input });
        expect(spy).toHaveBeenCalledOnce();
        expect(spy).toHaveBeenCalledWith(
          CREATE_ACCOUNT_TOOL,
          expect.objectContaining(variation.expected),
        );
        spy.mockRestore();
      }
    });
  });

  describe.skip('Tool Available', () => {
    it('should have create account tool available', () => {
      const tools = toolkit.getTools();
      const createAccount = tools.find(tool => tool.name === 'create_account_tool');

      expect(createAccount).toBeDefined();
      expect(createAccount!.name).toBe('create_account_tool');
      expect(createAccount!.description).toContain('create a new Hedera account');
    });
  });
});
