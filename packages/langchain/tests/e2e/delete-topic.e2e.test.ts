import { afterAll, beforeAll, describe, it, expect } from 'vitest';
import { createLangchainTestSetup, type LangchainTestSetup } from '@tests/utils';
import {
  getProfile,
  HederaOperationsWrapper,
  type TestAccount,
  waitForMirrorTx,
  itWithRetry,
} from '@hashgraph/hedera-agent-kit-tests';
import { ResponseParserService } from '@hashgraph/hedera-agent-kit-langchain';
import { ReactAgent } from 'langchain';
import { Client } from '@hiero-ledger/sdk';

describe('Delete Topic E2E Tests', () => {
  const profile = getProfile();
  let testSetup: LangchainTestSetup;
  let agent: ReactAgent;
  let responseParsingService: ResponseParserService;
  let executor: TestAccount;
  let executorClient: Client;
  let executorWrapper: HederaOperationsWrapper;

  beforeAll(async () => {
    executor = await profile.accounts.acquire({ tier: 'MINIMAL' });
    ({ client: executorClient, wrapper: executorWrapper } = profile.client.connectAs(executor));

    testSetup = await createLangchainTestSetup(undefined, undefined, executorClient);
    agent = testSetup.agent;
    responseParsingService = testSetup.responseParser;

    // create a topic to delete
    const createInput = 'Create a new Hedera topic';
    const createResult = await agent.invoke({
      messages: [
        {
          role: 'user',
          content: createInput,
        },
      ],
    });
    const createParsedResponse = responseParsingService.parseNewToolMessages(createResult);
    if (!createParsedResponse[0].parsedData.raw?.topicId)
      throw new Error('Failed to create topic for delete test');
  });

  afterAll(async () => {
    await profile.accounts.release(executor);
    testSetup?.cleanup();
    executorClient?.close();
  });

  it(
    'deletes topic via natural language',
    itWithRetry(async () => {
      // create a topic to be deleted
      const createParams: any = { adminKey: executor.privateKey.publicKey };
      const createResult: any = await executorWrapper.createTopic(createParams);
      if (!createResult.topicId) throw new Error('Failed to create topic for delete test');

      const input = `Delete topic ${createResult.topicId!}`;
      const res = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: input,
          },
        ],
      });
      const parsedResponse = responseParsingService.parseNewToolMessages(res);

      expect(parsedResponse).toBeDefined();
      expect(parsedResponse[0].parsedData.humanMessage).toContain('Topic with id');
      expect(parsedResponse[0].parsedData.raw.transactionId).toBeDefined();

      await waitForMirrorTx(executorWrapper, parsedResponse[0].parsedData.raw.transactionId);
    }),
  );
});
