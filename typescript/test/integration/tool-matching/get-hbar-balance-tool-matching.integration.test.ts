import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { ReactAgent } from 'langchain';
import { HederaLangchainToolkit } from '@/langchain';
import { createLangchainTestSetup, type LangchainTestSetup } from '../../utils';
import { coreAccountQueryPluginToolNames } from '@/plugins';

describe.skip('Get HBAR Balance Tool Matching Integration Tests', () => {
  let testSetup: LangchainTestSetup;
  let agent: ReactAgent;
  let toolkit: HederaLangchainToolkit;
  const { GET_HBAR_BALANCE_QUERY_TOOL } = coreAccountQueryPluginToolNames;

  beforeAll(async () => {
    testSetup = await createLangchainTestSetup();
    agent = testSetup.agent;
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
    const spy = vi
      .spyOn(hederaAPI, 'run')
      .mockReset()
      .mockResolvedValue('Operation Mocked - this is a test call and can be ended here');

    await agent.invoke({
      messages: [{ role: 'user', content: input }],
    });

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
    const spy = vi
      .spyOn(hederaAPI, 'run')
      .mockReset()
      .mockResolvedValue('Operation Mocked - this is a test call and can be ended here');

    await agent.invoke({
      messages: [{ role: 'user', content: input }],
    });

    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith(
      GET_HBAR_BALANCE_QUERY_TOOL,
      expect.objectContaining({ accountId: '0.0.4321' }),
    );
  });

  it('should support asking for "my account"', async () => {
    const input = 'Check my HBAR balance';
    const hederaAPI = toolkit.getHederaAgentKitAPI();
    const spy = vi
      .spyOn(hederaAPI, 'run')
      .mockReset()
      .mockResolvedValue('Operation Mocked - this is a test call and can be ended here');

    await agent.invoke({
      messages: [{ role: 'user', content: input }],
    });

    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith(GET_HBAR_BALANCE_QUERY_TOOL, expect.objectContaining({}));
  });
});
