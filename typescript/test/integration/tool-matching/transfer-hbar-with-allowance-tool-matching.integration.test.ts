import { AgentExecutor } from 'langchain/agents';
import { HederaLangchainToolkit } from '@/langchain';
import { createLangchainTestSetup, type LangchainTestSetup } from '../../utils';
import { coreAccountPluginToolNames } from '@/plugins';
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';

describe('Transfer HBAR With Allowance Tool Matching Integration Tests', () => {
  let testSetup: LangchainTestSetup;
  let agentExecutor: AgentExecutor;
  let toolkit: HederaLangchainToolkit;
  const { TRANSFER_HBAR_WITH_ALLOWANCE_TOOL } = coreAccountPluginToolNames;

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
    it('should match transfer HBAR with allowance tool for simple allowance transfer', async () => {
      const input = 'Transfer 2 HBAR from 0.0.1002 to 0.0.2002 using allowance';
      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');
      await agentExecutor.invoke({ input });
      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        TRANSFER_HBAR_WITH_ALLOWANCE_TOOL,
        expect.objectContaining({
          sourceAccountId: '0.0.1002',
          transfers: expect.arrayContaining([
            expect.objectContaining({
              accountId: '0.0.2002',
              amount: 2,
            }),
          ]),
        }),
      );
    });

    it('should handle multiple recipients in a single allowance transfer command', async () => {
      const input =
        'Use allowance from 0.0.1002 to send 5 HBAR to 0.0.2002 and 10 HBAR to 0.0.3003';
      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');
      await agentExecutor.invoke({ input });
      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        TRANSFER_HBAR_WITH_ALLOWANCE_TOOL,
        expect.objectContaining({
          sourceAccountId: '0.0.1002',
          transfers: expect.arrayContaining([
            expect.objectContaining({ accountId: '0.0.2002', amount: 5 }),
            expect.objectContaining({ accountId: '0.0.3003', amount: 10 }),
          ]),
        }),
      );
    });

    it('should match even if phrased differently ("spend allowance from...")', async () => {
      const input = 'Spend allowance from account 0.0.1002 to send 3.5 HBAR to 0.0.2002';
      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');
      await agentExecutor.invoke({ input });
      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        TRANSFER_HBAR_WITH_ALLOWANCE_TOOL,
        expect.objectContaining({
          sourceAccountId: '0.0.1002',
          transfers: expect.arrayContaining([
            expect.objectContaining({
              accountId: '0.0.2002',
              amount: 3.5,
            }),
          ]),
        }),
      );
    });

    it('should not falsely trigger when input does not mention allowance', async () => {
      const input = 'Transfer 10 HBAR from 0.0.1002 to 0.0.2002';
      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');
      await agentExecutor.invoke({ input });
      expect(spy).not.toHaveBeenCalledWith(TRANSFER_HBAR_WITH_ALLOWANCE_TOOL, expect.anything());
    });
  });
});
