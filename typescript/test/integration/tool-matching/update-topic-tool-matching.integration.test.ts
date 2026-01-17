import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { ReactAgent } from 'langchain';
import { HederaLangchainToolkit } from '@/langchain';
import { createLangchainTestSetup, type LangchainTestSetup } from '../../utils';
import { UPDATE_TOPIC_TOOL } from '@/plugins/core-consensus-plugin/tools/consensus/update-topic';

describe('Update Topic Tool Matching Integration Tests', () => {
  let testSetup: LangchainTestSetup;
  let agent: ReactAgent;
  let toolkit: HederaLangchainToolkit;

  beforeAll(async () => {
    testSetup = await createLangchainTestSetup();
    agent = testSetup.agent;
    toolkit = testSetup.toolkit;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should match update topic tool with topic memo and submit key', async () => {
    const input = "Update topic 0.0.5005 with memo 'new memo' and set submit key to my key";
    const hederaAPI = toolkit.getHederaAgentKitAPI();
    const spy = vi
      .spyOn(hederaAPI, 'run')
      .mockReset()
      .mockResolvedValue('Operation Mocked - this is a test call and can be ended here');

    await agent.invoke({
      messages: [{ role: 'user', content: input }],
    });

    expect(spy).toHaveBeenCalledWith(
      UPDATE_TOPIC_TOOL,
      expect.objectContaining({
        topicId: '0.0.5005',
        topicMemo: 'new memo',
        submitKey: true,
      }),
    );
  });

  it('should match with multiple fields (memo, autoRenewPeriod, expirationTime)', async () => {
    const input =
      'For topic 0.0.1234 set memo "hello", auto renew period 7890000 and expiration time 2030-01-01T00:00:00Z';

    const hederaAPI = toolkit.getHederaAgentKitAPI();
    const spy = vi
      .spyOn(hederaAPI, 'run')
      .mockReset()
      .mockResolvedValue('Operation Mocked - this is a test call and can be ended here');

    await agent.invoke({
      messages: [{ role: 'user', content: input }],
    });

    expect(spy).toHaveBeenCalledWith(
      UPDATE_TOPIC_TOOL,
      expect.objectContaining({
        topicId: '0.0.1234',
        topicMemo: 'hello',
        autoRenewPeriod: 7890000,
        expirationTime: '2030-01-01T00:00:00Z',
      }),
    );
  });
});
