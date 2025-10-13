import { AgentExecutor } from 'langchain/agents';
import { HederaLangchainToolkit } from '@/langchain';
import { createLangchainTestSetup, type LangchainTestSetup } from '../../utils';
import { coreTokenPluginToolNames } from '@/plugins';
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';

describe('Transfer NFT With Allowance Tool Matching Integration', () => {
  let setup: LangchainTestSetup;
  let agentExecutor: AgentExecutor;
  let toolkit: HederaLangchainToolkit;
  const { TRANSFER_NON_FUNGIBLE_TOKEN_WITH_ALLOWANCE_TOOL } = coreTokenPluginToolNames;

  beforeAll(async () => {
    setup = await createLangchainTestSetup();
    agentExecutor = setup.agentExecutor;
    toolkit = setup.toolkit;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
  afterAll(async () => setup?.cleanup());

  it('matches tool for simple NFT allowance transfer', async () => {
    const input = 'Transfer NFT 0.0.2001 serial 5 from 0.0.1002 to 0.0.3003 using allowance';
    const hederaAPI = toolkit.getHederaAgentKitAPI();
    const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

    await agentExecutor.invoke({ input });

    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith(
      TRANSFER_NON_FUNGIBLE_TOKEN_WITH_ALLOWANCE_TOOL,
      expect.objectContaining({
        sourceAccountId: '0.0.1002',
        tokenId: '0.0.2001',
        recipients: [expect.objectContaining({ recipientId: '0.0.3003', serialNumber: 5 })],
      }),
    );
  });

  it('should support multiple serial transfers in one command', async () => {
    const input =
      'Use allowance from 0.0.1002 to send NFT 0.0.2001 serial 1 to 0.0.3003 and serial 2 to 0.0.4004';
    const hederaAPI = toolkit.getHederaAgentKitAPI();
    const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');
    await agentExecutor.invoke({ input });

    expect(spy).toHaveBeenCalledWith(
      TRANSFER_NON_FUNGIBLE_TOKEN_WITH_ALLOWANCE_TOOL,
      expect.objectContaining({
        recipients: expect.arrayContaining([
          expect.objectContaining({ recipientId: '0.0.3003', serialNumber: 1 }),
          expect.objectContaining({ recipientId: '0.0.4004', serialNumber: 2 }),
        ]),
      }),
    );
  });
});
