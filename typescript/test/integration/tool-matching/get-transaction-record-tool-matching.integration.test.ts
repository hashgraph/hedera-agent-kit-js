import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { AgentExecutor } from 'langchain/agents';
import { HederaLangchainToolkit } from '@/langchain';
import { createLangchainTestSetup, type LangchainTestSetup } from '../../utils';
import { coreTransactionQueryPluginToolNames } from '@/plugins';

const { GET_TRANSACTION_RECORD_QUERY_TOOL } = coreTransactionQueryPluginToolNames;

describe.skip('Get Transaction Record - Tool Matching Integration Tests', () => {
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

  it('should match get transaction record tool for a direct request', async () => {
    const hederaAPI = toolkit.getHederaAgentKitAPI();
    const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue(''); //spies on the run method of the HederaAgentKitAPI and stops it from executing

    const txId = '0.0.5-1755169980-651721264';
    const input = `Get the transaction record for transaction ID ${txId}`;

    await agentExecutor.invoke({ input });

    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith(
      GET_TRANSACTION_RECORD_QUERY_TOOL,
      expect.objectContaining({ transactionId: txId }),
    );
  });

  it('should match get transaction record tool and parse transactionId from input to the required format', async () => {
    const hederaAPI = toolkit.getHederaAgentKitAPI();
    const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue(''); //spies on the run method of the HederaAgentKitAPI and stops it from executing

    const txId = '0.0.90@1756968265.343000618';
    const parsedTxId = '0.0.90-1756968265-343000618';
    const input = `Get the transaction record for transaction ID ${txId}`;

    await agentExecutor.invoke({ input });

    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith(
      GET_TRANSACTION_RECORD_QUERY_TOOL,
      expect.objectContaining({ transactionId: parsedTxId }),
    );
  });
});
