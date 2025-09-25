import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { AgentExecutor } from 'langchain/agents';
import { HederaLangchainToolkit } from '@/langchain';
import { createLangchainTestSetup, type LangchainTestSetup } from '../../utils';
import { coreAccountQueryPluginToolNames } from '@/plugins';

const { GET_ACCOUNT_TOKEN_BALANCES_QUERY_TOOL } = coreAccountQueryPluginToolNames;

describe.skip('Get Account Token Balances - Tool Matching Integration Tests', () => {
  let testSetup: LangchainTestSetup;
  let agentExecutor: AgentExecutor;
  let toolkit: HederaLangchainToolkit;

  beforeAll(async () => {
    testSetup = await createLangchainTestSetup();
    agentExecutor = testSetup.agentExecutor;
    toolkit = testSetup.toolkit;
  });

  afterAll(async () => {
    if (testSetup) testSetup.cleanup();
  });

  it('should match get account token balances tool for a direct request', async () => {
    const hederaAPI = toolkit.getHederaAgentKitAPI();
    const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue(''); //spies on the run method of the HederaAgentKitAPI and stops it from executing

    const accountId = '0.0.5544333';
    const input = `Get the token balances for account ${accountId}`;

    await agentExecutor.invoke({ input });

    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith(
      GET_ACCOUNT_TOKEN_BALANCES_QUERY_TOOL,
      expect.objectContaining({ accountId: accountId }),
    );
  });

  it('should match get token balances tool for calls with no passed accountId', async () => {
    const hederaAPI = toolkit.getHederaAgentKitAPI();
    const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue(''); //spies on the run method of the HederaAgentKitAPI and stops it from executing

    const input = `Show me my token balances`;

    await agentExecutor.invoke({ input });

    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith(
      GET_ACCOUNT_TOKEN_BALANCES_QUERY_TOOL,
      expect.objectContaining({}),
    );
  });
});
