import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { AgentExecutor } from 'langchain/agents';
import { HederaLangchainToolkit } from '@/langchain';
import { createLangchainTestSetup, type LangchainTestSetup } from '../../utils';
import { coreMiscQueriesPluginsToolNames } from '@/plugins';

describe.skip('Get Exchange Rate Tool Matching Integration Tests', () => {
  let testSetup: LangchainTestSetup;
  let agentExecutor: AgentExecutor;
  let toolkit: HederaLangchainToolkit;
  const { GET_EXCHANGE_RATE_TOOL } = coreMiscQueriesPluginsToolNames;

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

  it('should match get exchange rate tool for a simple query', async () => {
    const input = 'What is the current HBAR exchange rate?';

    const hederaAPI = toolkit.getHederaAgentKitAPI();
    const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

    await agentExecutor.invoke({ input });

    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith(GET_EXCHANGE_RATE_TOOL, expect.objectContaining({}));
  });

  it('should extract a precise timestamp from the query', async () => {
    const input = 'Get the HBAR exchange rate at 1726000000.123456789';

    const hederaAPI = toolkit.getHederaAgentKitAPI();
    const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

    await agentExecutor.invoke({ input });

    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith(
      GET_EXCHANGE_RATE_TOOL,
      expect.objectContaining({ timestamp: '1726000000.123456789' }),
    );
  });

  it('should support alternative phrasing and integer timestamp', async () => {
    const input = 'HBAR/USD rate at 1726000000';

    const hederaAPI = toolkit.getHederaAgentKitAPI();
    const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

    await agentExecutor.invoke({ input });

    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith(
      GET_EXCHANGE_RATE_TOOL,
      expect.objectContaining({ timestamp: '1726000000' }),
    );
  });
});
