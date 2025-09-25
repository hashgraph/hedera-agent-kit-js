import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { AgentExecutor } from 'langchain/agents';
import { HederaLangchainToolkit } from '@/langchain';
import { createLangchainTestSetup, type LangchainTestSetup } from '../../utils';
import { coreAccountPluginToolNames } from '@/plugins';

describe.skip('Sign Schedule Transaction Tool Matching Integration Tests', () => {
  let testSetup: LangchainTestSetup;
  let agentExecutor: AgentExecutor;
  let toolkit: HederaLangchainToolkit;
  const { SIGN_SCHEDULE_TRANSACTION_TOOL } = coreAccountPluginToolNames;

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
    it('should match sign schedule transaction tool for simple sign request', async () => {
      const input = 'Sign the scheduled transaction with ID 0.0.123456';

      // Get the Hedera Agent Kit API from the toolkit
      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue(''); //spies on the run method of the HederaAgentKitAPI and stops it from executing

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        SIGN_SCHEDULE_TRANSACTION_TOOL,
        expect.objectContaining({
          scheduleId: '0.0.123456',
        }),
      );
    });

    it('should match sign schedule transaction tool with different wording', async () => {
      const input = 'Please sign scheduled transaction 0.0.789012';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue(''); //spies on the run method of the HederaAgentKitAPI and stops it from executing

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        SIGN_SCHEDULE_TRANSACTION_TOOL,
        expect.objectContaining({
          scheduleId: '0.0.789012',
        }),
      );
    });

    // this test is skipped because it is not working as expected.
    // Sometimes the LLM does not match the tool correctly for "approve" wording.
    it.skip('should match sign schedule transaction tool with "approve" wording', async () => {
      const input = 'Approve the scheduled transaction 0.0.345678';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue(''); //spies on the run method of the HederaAgentKitAPI and stops it from executing

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        SIGN_SCHEDULE_TRANSACTION_TOOL,
        expect.objectContaining({
          scheduleId: '0.0.345678',
        }),
      );
    });

    it('should match sign schedule transaction tool with "execute" wording', async () => {
      const input = 'Execute the scheduled transaction with ID 0.0.901234';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue(''); //spies on the run method of the HederaAgentKitAPI and stops it from executing

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        SIGN_SCHEDULE_TRANSACTION_TOOL,
        expect.objectContaining({
          scheduleId: '0.0.901234',
        }),
      );
    });

    it('should match sign schedule transaction tool with "authorize" wording', async () => {
      const input = 'Authorize scheduled transaction 0.0.567890';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue(''); //spies on the run method of the HederaAgentKitAPI and stops it from executing

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        SIGN_SCHEDULE_TRANSACTION_TOOL,
        expect.objectContaining({
          scheduleId: '0.0.567890',
        }),
      );
    });

    it('should match sign schedule transaction tool with "confirm" wording', async () => {
      const input = 'Confirm the scheduled transaction 0.0.111222';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue(''); //spies on the run method of the HederaAgentKitAPI and stops it from executing

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        SIGN_SCHEDULE_TRANSACTION_TOOL,
        expect.objectContaining({
          scheduleId: '0.0.111222',
        }),
      );
    });

    it('should handle various natural language variations', async () => {
      const variations = [
        {
          input: 'Please sign the scheduled transaction with ID 0.0.333444',
          scheduleId: '0.0.333444',
        },
        { input: 'I want to sign scheduled transaction 0.0.555666', scheduleId: '0.0.555666' },
        { input: 'Can you sign the scheduled transaction 0.0.777888?', scheduleId: '0.0.777888' },
        { input: 'Sign scheduled transaction ID 0.0.999000', scheduleId: '0.0.999000' },
        { input: 'Execute scheduled transaction with ID 0.0.222444', scheduleId: '0.0.222444' },
      ];

      const hederaAPI = toolkit.getHederaAgentKitAPI();

      for (const variation of variations) {
        const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue(''); //spies on the run method of the HederaAgentKitAPI and stops it from executing

        await agentExecutor.invoke({ input: variation.input });

        expect(spy).toHaveBeenCalledOnce();
        expect(spy).toHaveBeenCalledWith(
          SIGN_SCHEDULE_TRANSACTION_TOOL,
          expect.objectContaining({
            scheduleId: variation.scheduleId,
          }),
        );
        spy.mockRestore();
      }
    });

    it('should extract correct parameters for complex sign request', async () => {
      const input =
        'Please sign the scheduled transaction with ID 0.0.123456789 as soon as possible';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue(''); //spies on the run method of the HederaAgentKitAPI and stops it from executing

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        SIGN_SCHEDULE_TRANSACTION_TOOL,
        expect.objectContaining({
          scheduleId: '0.0.123456789',
        }),
      );
    });

    it('should extract correct parameters for not straightforward user input', async () => {
      const input = 'I need to sign scheduled transaction 0.0.987654321 for approval';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue(''); //spies on the run method of the HederaAgentKitAPI and stops it from executing

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        SIGN_SCHEDULE_TRANSACTION_TOOL,
        expect.objectContaining({
          scheduleId: '0.0.987654321',
        }),
      );
    });

    it('should handle schedule ID with different formats', async () => {
      const input = 'Sign scheduled transaction 0.0.123';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue(''); //spies on the run method of the HederaAgentKitAPI and stops it from executing

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        SIGN_SCHEDULE_TRANSACTION_TOOL,
        expect.objectContaining({
          scheduleId: '0.0.123',
        }),
      );
    });
  });

  describe.skip('Tool Available', () => {
    it('should have sign schedule transaction tool available', () => {
      const tools = toolkit.getTools();
      const signScheduleTransactionTool = tools.find(
        tool => tool.name === 'sign_schedule_transaction_tool',
      );

      expect(signScheduleTransactionTool).toBeDefined();
      expect(signScheduleTransactionTool!.name).toBe('sign_schedule_transaction_tool');
      expect(signScheduleTransactionTool!.description).toContain('sign a scheduled transaction');
    });
  });
});
