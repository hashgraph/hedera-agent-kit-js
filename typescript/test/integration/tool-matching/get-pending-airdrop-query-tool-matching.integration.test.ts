import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { AgentExecutor } from 'langchain/agents';
import { createLangchainTestSetup, type LangchainTestSetup } from '../../utils';
import { HederaLangchainToolkit } from '@/langchain';
import { coreTokenQueryPluginToolNames } from 'hedera-agent-kit';

const { GET_PENDING_AIRDROP_TOOL } = coreTokenQueryPluginToolNames;

describe('Get Pending Airdrop Tool Matching Integration Tests', () => {
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

  it('should match get pending airdrops tool for "pending airdrops" query', async () => {
    const hederaAPI = toolkit.getHederaAgentKitAPI();
    const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

    const accountId = '0.0.1231233';
    const input = `Show pending airdrops for account ${accountId}`;

    await agentExecutor.invoke({ input });

    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith(
      GET_PENDING_AIRDROP_TOOL,
      expect.objectContaining({ accountId }),
    );
  });

  it('should match get pending airdrops tool for "get pending airdrops" phrase', async () => {
    const hederaAPI = toolkit.getHederaAgentKitAPI();
    const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

    const accountId = '0.0.8888';
    const input = `Get pending airdrops for ${accountId}`;

    await agentExecutor.invoke({ input });

    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith(
      GET_PENDING_AIRDROP_TOOL,
      expect.objectContaining({ accountId }),
    );
  });
});


