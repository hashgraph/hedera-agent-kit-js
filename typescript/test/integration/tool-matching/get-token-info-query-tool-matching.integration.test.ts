import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { AgentExecutor } from 'langchain/agents';
import { createLangchainTestSetup, type LangchainTestSetup } from '../../utils';
import { HederaLangchainToolkit } from '@/langchain';
import { coreTokenQueryPluginToolNames } from 'hedera-agent-kit';

const { GET_TOKEN_INFO_QUERY_TOOL } = coreTokenQueryPluginToolNames;

describe.skip('Get Token Info Query Tool Matching Integration Tests', () => {
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

  it('should match get token info tool for "get token info" query', async () => {
    const hederaAPI = toolkit.getHederaAgentKitAPI();
    const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue(''); //spies on the run method of the HederaAgentKitAPI and stops it from executing

    const tokenId = '0.0.1231233';
    const input = `Get token info for ${tokenId}`;

    await agentExecutor.invoke({ input });

    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith(
      GET_TOKEN_INFO_QUERY_TOOL,
      expect.objectContaining({ tokenId: tokenId }),
    );
  });

  it('should match get token info tool for "token information" query', async () => {
    const hederaAPI = toolkit.getHederaAgentKitAPI();
    const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue(''); //spies on the run method of the HederaAgentKitAPI and stops it from executing

    const tokenId = '0.0.1231233';
    const input = `Get token information for ${tokenId}`;

    await agentExecutor.invoke({ input });

    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith(
      GET_TOKEN_INFO_QUERY_TOOL,
      expect.objectContaining({ tokenId: tokenId }),
    );
  });

  it('should match get token info tool for "token details" query', async () => {
    const hederaAPI = toolkit.getHederaAgentKitAPI();
    const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue(''); //spies on the run method of the HederaAgentKitAPI and stops it from executing

    const tokenId = '0.0.1231233';
    const input = `Get token details for ${tokenId}`;

    await agentExecutor.invoke({ input });

    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith(
      GET_TOKEN_INFO_QUERY_TOOL,
      expect.objectContaining({ tokenId: tokenId }),
    );
  });

  it('should match get token info tool for "query token" phrase', async () => {
    const hederaAPI = toolkit.getHederaAgentKitAPI();
    const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue(''); //spies on the run method of the HederaAgentKitAPI and stops it from executing

    const tokenId = '0.0.1231233';
    const input = `Query token ${tokenId}`;

    await agentExecutor.invoke({ input });

    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith(
      GET_TOKEN_INFO_QUERY_TOOL,
      expect.objectContaining({ tokenId: tokenId }),
    );
  });

  it('should match get token info tool for "check token" phrase', async () => {
    const hederaAPI = toolkit.getHederaAgentKitAPI();
    const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue(''); //spies on the run method of the HederaAgentKitAPI and stops it from executing

    const tokenId = '0.0.1231233';
    const input = `Check token ${tokenId}`;

    await agentExecutor.invoke({ input });

    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith(
      GET_TOKEN_INFO_QUERY_TOOL,
      expect.objectContaining({ tokenId: tokenId }),
    );
  });
});
