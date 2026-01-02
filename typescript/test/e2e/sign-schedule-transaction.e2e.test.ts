import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { AccountId, Client, Key, PrivateKey, PublicKey } from '@hashgraph/sdk';
import { ReactAgent } from 'langchain';
import {
  createLangchainTestSetup,
  getCustomClient,
  getOperatorClientForTests,
  HederaOperationsWrapper,
  LangchainTestSetup,
} from '../utils';
import { ResponseParserService } from '@/langchain';
import { itWithRetry } from '../utils/retry-util';
import { transferHbarParametersNormalised } from '@/shared/parameter-schemas/account.zod';
import { z } from 'zod';
import { UsdToHbarService } from '../utils/usd-to-hbar-service';
import { BALANCE_TIERS } from '../utils/setup/langchain-test-config';
import { returnHbarsAndDeleteAccount } from '../utils/teardown/account-teardown';

describe('Sign Schedule Transaction E2E Tests', () => {
  let testSetup: LangchainTestSetup;
  let agent: ReactAgent;
  let responseParsingService: ResponseParserService;
  let operatorClient: Client;
  let executorClient: Client;
  let operatorWrapper: HederaOperationsWrapper;
  let executorWrapper: HederaOperationsWrapper;
  let recipientAccountId: AccountId;

  beforeAll(async () => {
    // operator client creation
    operatorClient = getOperatorClientForTests();
    operatorWrapper = new HederaOperationsWrapper(operatorClient);

    // execution account and client creation
    const executorKeyPair = PrivateKey.generateED25519();
    const executorAccountId = await operatorWrapper
      .createAccount({
        key: executorKeyPair.publicKey,
        initialBalance: UsdToHbarService.usdToHbar(BALANCE_TIERS.MINIMAL),
      })
      .then(resp => resp.accountId!);

    executorClient = getCustomClient(executorAccountId, executorKeyPair);
    executorWrapper = new HederaOperationsWrapper(executorClient);

    // langchain setup with execution account
    testSetup = await createLangchainTestSetup(undefined, undefined, executorClient);
    agent = testSetup.agent;
    responseParsingService = testSetup.responseParser;
  });

  afterAll(async () => {
    if (testSetup && operatorClient) {
      await returnHbarsAndDeleteAccount(
        executorWrapper,
        executorClient.operatorAccountId!,
        operatorClient.operatorAccountId!,
      );
      testSetup.cleanup();
      operatorClient.close();
    }
  });

  beforeEach(async () => {
    // Create a recipient account
    recipientAccountId = await executorWrapper
      .createAccount({
        key: executorClient.operatorPublicKey as Key,
        initialBalance: 0,
      })
      .then(resp => resp.accountId!);
  });

  afterEach(async () => {
    await executorWrapper.deleteAccount({
      accountId: recipientAccountId,
      transferAccountId: executorClient.operatorAccountId!,
    });
  });

  it(
    'should sign a scheduled transaction',
    itWithRetry(async () => {
      // First, create a scheduled transaction
      const transferAmount = 0.1;
      const transferParams: z.infer<ReturnType<typeof transferHbarParametersNormalised>> = {
        hbarTransfers: [
          {
            accountId: recipientAccountId,
            amount: transferAmount,
          },
          {
            accountId: executorClient.operatorAccountId!,
            amount: -transferAmount,
          },
        ],
        schedulingParams: {
          isScheduled: true,
          adminKey: operatorClient.operatorPublicKey as PublicKey,
        },
      };

      const scheduleTx = await operatorWrapper.transferHbar(transferParams);
      const scheduleId = scheduleTx.scheduleId!.toString();
      // Now sign the scheduled transaction using the agent
      const input = `Sign the scheduled transaction with ID ${scheduleId}`;

      const result = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: input,
          },
        ],
      });

      const parsedResponse = responseParsingService.parseNewToolMessages(result);
      expect(parsedResponse[0].parsedData.humanMessage).toContain(
        'Transaction successfully signed',
      );
      expect(parsedResponse[0].parsedData.humanMessage).toContain('Transaction ID');
    }),
  );

  it(
    'should handle invalid schedule ID',
    itWithRetry(async () => {
      const invalidScheduleId = '0.0.999999';
      const input = `Sign the scheduled transaction with ID ${invalidScheduleId}`;

      const result = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: input,
          },
        ],
      });
      const parsedResponse = responseParsingService.parseNewToolMessages(result);
      // Should handle the error gracefully
      expect(parsedResponse[0].parsedData.humanMessage).toContain(
        'Failed to sign scheduled transaction',
      );
    }),
  );
});
