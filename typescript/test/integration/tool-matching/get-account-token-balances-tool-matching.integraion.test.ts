import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { ReactAgent } from 'langchain';
import { HederaLangchainToolkit } from '@/langchain';
import { createLangchainTestSetup, type LangchainTestSetup } from '../../utils';
import { coreAccountQueryPluginToolNames } from '@/plugins';

const { GET_ACCOUNT_TOKEN_BALANCES_QUERY_TOOL } = coreAccountQueryPluginToolNames;

describe.skip('Get Account Token Balances - Tool Matching Integration Tests', () => {
  let testSetup: LangchainTestSetup;
  let agent: ReactAgent;
  let toolkit: HederaLangchainToolkit;

  beforeAll(async () => {
    testSetup = await createLangchainTestSetup();
    agent = testSetup.agent;
    toolkit = testSetup.toolkit;
  });

  afterAll(async () => {
    if (testSetup) testSetup.cleanup();
  });

  it('should match get account token balances tool for a direct request', async () => {
    const hederaAPI = toolkit.getHederaAgentKitAPI();
    const spy = vi
      .spyOn(hederaAPI, 'run')
      .mockReset()
      .mockResolvedValue('Operation Mocked - this is a test call and can be ended here');

    const accountId = '0.0.5544333';
    const input = `Get the token balances for account ${accountId}`;

    await agent.invoke({
      messages: [{ role: 'user', content: input }],
    });

    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith(
      GET_ACCOUNT_TOKEN_BALANCES_QUERY_TOOL,
      expect.objectContaining({ accountId: accountId }),
    );
  });

  it('should match get token balances tool for calls with no passed accountId', async () => {
    const hederaAPI = toolkit.getHederaAgentKitAPI();
    const spy = vi
      .spyOn(hederaAPI, 'run')
      .mockReset()
      .mockResolvedValue('Operation Mocked - this is a test call and can be ended here');

    const input = `Show me my token balances`;

    await agent.invoke({
      messages: [{ role: 'user', content: input }],
    });

    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith(
      GET_ACCOUNT_TOKEN_BALANCES_QUERY_TOOL,
      expect.objectContaining({}),
    );
  });
});
