import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { createLangchainTestSetup, LangchainTestSetup } from '../../utils';
import { AgentExecutor } from 'langchain/agents';
import { HederaLangchainToolkit } from '@/langchain';
import { TRANSFER_FUNGIBLE_TOKEN_WITH_ALLOWANCE_TOOL } from '@/plugins/core-token-plugin/tools/fungible-token/transfer-fungible-token-with-allowance';

describe('Transfer Fungible Token With Allowance Tool Matching Tests', () => {
  let testSetup: LangchainTestSetup;
  let agentExecutor: AgentExecutor;
  let toolkit: HederaLangchainToolkit;

  beforeAll(async () => {
    testSetup = await createLangchainTestSetup();
    agentExecutor = testSetup.agentExecutor;
    toolkit = testSetup.toolkit;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should match simple single-recipient token transfer with allowance', async () => {
    const input =
      "Transfer 100 of fungible token '0.0.33333' from 0.0.1002 to 0.0.2002 using allowance";
    const hederaAPI = toolkit.getHederaAgentKitAPI();
    const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

    await agentExecutor.invoke({ input });

    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith(
      TRANSFER_FUNGIBLE_TOKEN_WITH_ALLOWANCE_TOOL,
      expect.objectContaining({
        sourceAccountId: '0.0.1002',
        transfers: expect.arrayContaining([
          expect.objectContaining({ accountId: '0.0.2002', amount: 100 }),
        ]),
        tokenId: '0.0.33333',
      }),
    );
  });

  it('should handle multiple recipients in one allowance transfer', async () => {
    const input =
      "Use allowance from 0.0.1002 to send 50 TKN (Fungible token id: '0.0.33333') to account 0.0.2002 and 75 fungible tokens TKN to account 0.0.3003";
    const hederaAPI = toolkit.getHederaAgentKitAPI();
    const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

    await agentExecutor.invoke({ input });

    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith(
      TRANSFER_FUNGIBLE_TOKEN_WITH_ALLOWANCE_TOOL,
      expect.objectContaining({
        sourceAccountId: '0.0.1002',
        transfers: expect.arrayContaining([
          expect.objectContaining({ accountId: '0.0.2002', amount: 50 }),
          expect.objectContaining({ accountId: '0.0.3003', amount: 75 }),
        ]),
        tokenId: '0.0.33333',
      }),
    );
  });

  it('should match even with different phrasing ("spend allowance from...")', async () => {
    const input =
      'Spend allowance from account 0.0.1002 to send 25 fungible tokens with id 0.0.33333 to 0.0.2002';
    const hederaAPI = toolkit.getHederaAgentKitAPI();
    const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

    await agentExecutor.invoke({ input });

    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith(
      TRANSFER_FUNGIBLE_TOKEN_WITH_ALLOWANCE_TOOL,
      expect.objectContaining({
        sourceAccountId: '0.0.1002',
        transfers: expect.arrayContaining([
          expect.objectContaining({ accountId: '0.0.2002', amount: 25 }),
        ]),
        tokenId: '0.0.33333',
      }),
    );
  });

  it('should extract scheduling parameters when provided', async () => {
    const input =
      "Transfer 100 of fungible token '0.0.33333' from 0.0.1002 to 0.0.2002 using allowance. Schedule this transaction and make it expire tomorrow and wait for its expiration time with executing it.";

    const hederaAPI = toolkit.getHederaAgentKitAPI();
    const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

    await agentExecutor.invoke({ input });

    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith(
      TRANSFER_FUNGIBLE_TOKEN_WITH_ALLOWANCE_TOOL,
      expect.objectContaining({
        sourceAccountId: '0.0.1002',
        transfers: expect.arrayContaining([
          expect.objectContaining({ accountId: '0.0.2002', amount: 100 }),
        ]),
        tokenId: '0.0.33333',
        schedulingParams: expect.objectContaining({
          adminKey: false,
          isScheduled: true,
          expirationTime: expect.any(String),
          waitForExpiry: true,
        }),
      }),
    );
  });
});
