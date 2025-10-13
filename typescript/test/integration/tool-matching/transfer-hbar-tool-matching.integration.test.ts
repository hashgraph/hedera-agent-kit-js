import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { AgentExecutor } from 'langchain/agents';
import { HederaLangchainToolkit } from '@/langchain';
import { createLangchainTestSetup, type LangchainTestSetup } from '../../utils';
import { coreAccountPluginToolNames } from '@/plugins';

describe('Transfer HBAR Tool Matching Integration Tests', () => {
  let testSetup: LangchainTestSetup;
  let agentExecutor: AgentExecutor;
  let toolkit: HederaLangchainToolkit;
  const { TRANSFER_HBAR_TOOL } = coreAccountPluginToolNames;

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
    it('should match transfer HBAR tool for simple transfer request', async () => {
      const input = 'Transfer 1 HBAR to 0.0.1';

      // Get the Hedera Agent Kit API from the toolkit
      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue(''); //spies on the run method of the HederaAgentKitAPI and stops it from executing

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        TRANSFER_HBAR_TOOL,
        expect.objectContaining({
          transfers: expect.arrayContaining([
            expect.objectContaining({
              accountId: '0.0.1',
              amount: 1,
            }),
          ]),
        }),
      );
    });

    it('should match transfer HBAR tool with decimal amount', async () => {
      const input = 'Send 0.5 HBAR to account 0.0.2222';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue(''); //spies on the run method of the HederaAgentKitAPI and stops it from executing

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        TRANSFER_HBAR_TOOL,
        expect.objectContaining({
          transfers: expect.arrayContaining([
            expect.objectContaining({
              accountId: '0.0.2222',
              amount: 0.5,
            }),
          ]),
        }),
      );
    });

    it('should match transfer HBAR tool with memo', async () => {
      const input = 'Transfer 2 HBAR to 0.0.3333 with memo "Payment for services"';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue(''); //spies on the run method of the HederaAgentKitAPI and stops it from executing

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        TRANSFER_HBAR_TOOL,
        expect.objectContaining({
          transfers: expect.arrayContaining([
            expect.objectContaining({
              accountId: '0.0.3333',
              amount: 2,
            }),
          ]),
          transactionMemo: 'Payment for services',
        }),
      );
    });

    it('should match transfer HBAR tool for multiple recipients', async () => {
      const input = 'Send 1 HBAR to 0.0.1111 and 2 HBAR to 0.0.2222';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue(''); //spies on the run method of the HederaAgentKitAPI and stops it from executing

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        TRANSFER_HBAR_TOOL,
        expect.objectContaining({
          transfers: expect.arrayContaining([
            expect.objectContaining({
              accountId: '0.0.1111',
              amount: 1,
            }),
            expect.objectContaining({
              accountId: '0.0.2222',
              amount: 2,
            }),
          ]),
        }),
      );
    });

    it('should match transfer HBAR tool with explicit source account', async () => {
      const input = 'Transfer 0.1 HBAR from 0.0.5555 to 0.0.6666';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue(''); //spies on the run method of the HederaAgentKitAPI and stops it from executing

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        TRANSFER_HBAR_TOOL,
        expect.objectContaining({
          transfers: expect.arrayContaining([
            expect.objectContaining({
              accountId: '0.0.6666',
              amount: 0.1,
            }),
          ]),
          sourceAccountId: '0.0.5555',
        }),
      );
    });

    it('should extract scheduling parameters when provided', async () => {
      const input =
        'Send 0.5 HBAR to account 0.0.2222. Schedule it and make it expire tomorrow and wait for its expiration time with executing it.';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        TRANSFER_HBAR_TOOL,
        expect.objectContaining({
          transfers: expect.arrayContaining([
            expect.objectContaining({
              accountId: '0.0.2222',
              amount: 0.5,
            }),
          ]),
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
        { input: 'Please send 5 HBAR to account 0.0.7777', accountId: '0.0.7777', amount: 5 },
        { input: 'I want to transfer 3.14 HBAR to 0.0.8888', accountId: '0.0.8888', amount: 3.14 },
        { input: 'Can you move 10 HBAR to 0.0.9999?', accountId: '0.0.9999', amount: 10 },
        { input: 'Pay 0.01 HBAR to 0.0.1010', accountId: '0.0.1010', amount: 0.01 },
      ];

      const hederaAPI = toolkit.getHederaAgentKitAPI();

      for (const variation of variations) {
        const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue(''); //spies on the run method of the HederaAgentKitAPI and stops it from executing

        await agentExecutor.invoke({ input: variation.input });

        expect(spy).toHaveBeenCalledOnce();
        expect(spy).toHaveBeenCalledWith(
          TRANSFER_HBAR_TOOL,
          expect.objectContaining({
            transfers: expect.arrayContaining([
              expect.objectContaining({
                accountId: variation.accountId,
                amount: variation.amount,
              }),
            ]),
          }),
        );
        spy.mockRestore();
      }
    });

    it('should extract correct parameters for complex transfer request', async () => {
      const input =
        'Transfer 15.5 HBAR to 0.0.12345 with the memo "Monthly payment - invoice #123"';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue(''); //spies on the run method of the HederaAgentKitAPI and stops it from executing

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        TRANSFER_HBAR_TOOL,
        expect.objectContaining({
          transfers: expect.arrayContaining([
            expect.objectContaining({
              accountId: '0.0.12345',
              amount: 15.5,
            }),
          ]),
          transactionMemo: 'Monthly payment - invoice #123',
        }),
      );
    });

    it('should extract correct parameters for not straight forward user input', async () => {
      const input = 'Transfer 15.5 HBAR to account 0.0.12345 with "Monthly payment - invoice #123"';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue(''); //spies on the run method of the HederaAgentKitAPI and stops it from executing

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        TRANSFER_HBAR_TOOL,
        expect.objectContaining({
          transfers: expect.arrayContaining([
            expect.objectContaining({
              accountId: '0.0.12345',
              amount: 15.5,
            }),
          ]),
          transactionMemo: 'Monthly payment - invoice #123',
        }),
      );
    });
  });

  describe.skip('Tool Available', () => {
    it('should have transfer HBAR tool available', () => {
      const tools = toolkit.getTools();
      const transferHbarTool = tools.find(tool => tool.name === 'transfer_hbar_tool');

      expect(transferHbarTool).toBeDefined();
      expect(transferHbarTool!.name).toBe('transfer_hbar_tool');
      expect(transferHbarTool!.description).toContain('transfer HBAR');
    });
  });
});
