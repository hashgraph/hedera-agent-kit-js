import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { AgentExecutor } from 'langchain/agents';
import { HederaLangchainToolkit } from '@/langchain';
import { createLangchainTestSetup, type LangchainTestSetup } from '../../utils';
import { coreAccountQueryPluginToolNames } from '@/plugins';

describe.skip('Get HBAR Balance Tool Matching Integration Tests', () => {
  let testSetup: LangchainTestSetup;
  let agentExecutor: AgentExecutor;
  let toolkit: HederaLangchainToolkit;
  const { GET_HBAR_BALANCE_QUERY_TOOL } = coreAccountQueryPluginToolNames;

  beforeAll(async () => {
    testSetup = await createLangchainTestSetup();
    agentExecutor = testSetup.agentExecutor;
    toolkit = testSetup.toolkit;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    if (testSetup) testSetup.cleanup();
  });

  it('should match get HBAR balance tool for simple query', async () => {
    const input = 'What is the HBAR balance of account 0.0.1234?';

    const hederaAPI = toolkit.getHederaAgentKitAPI();
    const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue(''); //spies on the run method of the HederaAgentKitAPI and stops it from executing

    await agentExecutor.invoke({ input });

    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith(
      GET_HBAR_BALANCE_QUERY_TOOL,
      expect.objectContaining({
        accountId: '0.0.1234',
      }),
    );
  });

  it('should support variations without explicit "account" keyword', async () => {
    const input = 'Check HBAR for 0.0.4321';
    const hederaAPI = toolkit.getHederaAgentKitAPI();
    const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue(''); //spies on the run method of the HederaAgentKitAPI and stops it from executing

    await agentExecutor.invoke({ input });

    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith(
      GET_HBAR_BALANCE_QUERY_TOOL,
      expect.objectContaining({ accountId: '0.0.4321' }),
    );
  });

  it('should support asking for "my account"', async () => {
    const input = 'Check my HBAR balance';
    const hederaAPI = toolkit.getHederaAgentKitAPI();
    const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue(''); //spies on the run method of the HederaAgentKitAPI and stops it from executing

    await agentExecutor.invoke({ input });

    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith(GET_HBAR_BALANCE_QUERY_TOOL, expect.objectContaining({}));
  });
});
