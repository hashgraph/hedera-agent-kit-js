import { afterAll, beforeAll, describe, it, expect } from 'vitest';
import {
  getOperatorClientForTests,
  getCustomClient,
} from '@hashgraph/hedera-agent-kit-tests/shared/setup/client-setup';
import { createLangchainTestSetup, type LangchainTestSetup } from '@tests/utils';
import HederaOperationsWrapper from '@hashgraph/hedera-agent-kit-tests/shared/hedera-operations/HederaOperationsWrapper';
import { ResponseParserService } from '@hashgraph/hedera-agent-kit-langchain';
import { ReactAgent } from 'langchain';
import { Client, PrivateKey, AccountId } from '@hashgraph/sdk';
import { wait } from '@hashgraph/hedera-agent-kit-tests/shared/general-util';
import { returnHbarsAndDeleteAccount } from '@hashgraph/hedera-agent-kit-tests/shared/teardown/account-teardown';
import { MIRROR_NODE_WAITING_TIME } from '@hashgraph/hedera-agent-kit-tests/shared/test-constants';
import { itWithRetry } from '@hashgraph/hedera-agent-kit-tests/shared/retry-util';
import { UsdToHbarService } from '@hashgraph/hedera-agent-kit-tests/shared/usd-to-hbar-service';
import { BALANCE_TIERS } from '@tests/utils';

describe('Delete Topic E2E Tests', () => {
  let testSetup: LangchainTestSetup;
  let agent: ReactAgent;
  let responseParsingService: ResponseParserService;
  let operatorClient: Client;
  let operatorWrapper: HederaOperationsWrapper;
  let executorWrapper: HederaOperationsWrapper;
  let executorClient: Client;
  let executorKey: PrivateKey;
  let executorAccountId: AccountId;

  beforeAll(async () => {
    operatorClient = getOperatorClientForTests();
    operatorWrapper = new HederaOperationsWrapper(operatorClient);

    executorKey = PrivateKey.generateED25519();
    executorAccountId = await operatorWrapper
      .createAccount({
        key: executorKey.publicKey,
        initialBalance: UsdToHbarService.usdToHbar(BALANCE_TIERS.MINIMAL),
      })
      .then(r => r.accountId!);

    executorClient = getCustomClient(executorAccountId, executorKey);
    executorWrapper = new HederaOperationsWrapper(executorClient);

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
    if (operatorClient && executorClient) {
      await returnHbarsAndDeleteAccount(
        executorWrapper,
        executorClient.operatorAccountId!,
        operatorClient.operatorAccountId!,
      );
      operatorClient.close();
      executorClient.close();
    }
  });

  it(
    'deletes topic via natural language',
    itWithRetry(async () => {
      // create a topic to be deleted
      const createParams: any = { adminKey: executorClient.operatorPublicKey };
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

      await wait(MIRROR_NODE_WAITING_TIME);
    }),
  );
});
