import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { ReactAgent } from 'langchain';
import { HederaLangchainToolkit } from '@/langchain';
import { createLangchainTestSetup, type LangchainTestSetup } from '../../utils';
import { coreEVMQueryPluginToolNames } from '@/plugins';

const { GET_CONTRACT_INFO_QUERY_TOOL } = coreEVMQueryPluginToolNames;

describe.skip('Get Contract Info - Tool Matching Integration Tests', () => {
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

  it('should match get contract info tool for a direct request', async () => {
    const hederaAPI = toolkit.getHederaAgentKitAPI();
    const spy = vi
      .spyOn(hederaAPI, 'run')
      .mockResolvedValue('Operation Mocked - this is a test call and can be ended here');

    const contractId = '0.0.5005';
    const input = `Get the contract info for contract ID ${contractId}`;

    await agent.invoke({
      messages: [{ role: 'user', content: input }],
    });

    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith(
      GET_CONTRACT_INFO_QUERY_TOOL,
      expect.objectContaining({ contractId }),
    );
  });

  it('should match get contract info tool even when phrased differently', async () => {
    const hederaAPI = toolkit.getHederaAgentKitAPI();
    const spy = vi
      .spyOn(hederaAPI, 'run')
      .mockResolvedValue('Operation Mocked - this is a test call and can be ended here');

    const contractId = '0.0.6006';
    const input = `Please fetch details about the Hedera smart contract ${contractId}`;

    await agent.invoke({
      messages: [{ role: 'user', content: input }],
    });

    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith(
      GET_CONTRACT_INFO_QUERY_TOOL,
      expect.objectContaining({ contractId }),
    );
  });
});
