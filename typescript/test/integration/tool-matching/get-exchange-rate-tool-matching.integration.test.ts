import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { ReactAgent } from 'langchain';
import { HederaLangchainToolkit } from '@/langchain';
import { createLangchainTestSetup, type LangchainTestSetup } from '../../utils';
import { coreMiscQueriesPluginsToolNames } from '@/plugins';

describe.skip('Get Exchange Rate Tool Matching Integration Tests', () => {
  let testSetup: LangchainTestSetup;
  let agent: ReactAgent;
  let toolkit: HederaLangchainToolkit;
  const { GET_EXCHANGE_RATE_TOOL } = coreMiscQueriesPluginsToolNames;

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

  it('should match get exchange rate tool for a simple query', async () => {
    const input = 'What is the current HBAR exchange rate?';

    const hederaAPI = toolkit.getHederaAgentKitAPI();
    const spy = vi
      .spyOn(hederaAPI, 'run')
      .mockReset()
      .mockResolvedValue('Operation Mocked - this is a test call and can be ended here');

    await agent.invoke({
      messages: [{ role: 'user', content: input }],
    });

    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith(GET_EXCHANGE_RATE_TOOL, expect.objectContaining({}));
  });

  it('should extract a precise timestamp from the query', async () => {
    const input = 'Get the HBAR exchange rate at 1726000000.123456789';

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
      GET_EXCHANGE_RATE_TOOL,
      expect.objectContaining({ timestamp: '1726000000.123456789' }),
    );
  });

  it('should support alternative phrasing and integer timestamp', async () => {
    const input = 'HBAR/USD rate at 1726000000';

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
      GET_EXCHANGE_RATE_TOOL,
      expect.objectContaining({ timestamp: '1726000000' }),
    );
  });
});
