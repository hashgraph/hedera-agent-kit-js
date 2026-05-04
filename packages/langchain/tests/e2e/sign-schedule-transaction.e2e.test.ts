import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { Client, PublicKey } from '@hiero-ledger/sdk';
import { ReactAgent } from 'langchain';
import { createLangchainTestSetup, LangchainTestSetup } from '@tests/utils';
import {
  getProfile,
  HederaOperationsWrapper,
  type TestAccount,
} from '@hashgraph/hedera-agent-kit-tests';
import { ResponseParserService } from '@hashgraph/hedera-agent-kit-langchain';
import { transferHbarParametersNormalised } from '@hashgraph/hedera-agent-kit';
import { z } from 'zod';

describe('Sign Schedule Transaction E2E Tests', () => {
  const profile = getProfile();
  let testSetup: LangchainTestSetup;
  let agent: ReactAgent;
  let responseParsingService: ResponseParserService;
  let executor: TestAccount;
  let executorClient: Client;
  let recipient: TestAccount;

  beforeAll(async () => {
    executor = await profile.accounts.acquire({ tier: 'MINIMAL' });
    ({ client: executorClient } = profile.client.connectAs(executor));

    // langchain setup with execution account
    testSetup = await createLangchainTestSetup(undefined, undefined, executorClient);
    agent = testSetup.agent;
    responseParsingService = testSetup.responseParser;
  });

  afterAll(async () => {
    await profile.accounts.release(executor);
    testSetup?.cleanup();
    executorClient?.close();
  });

  beforeEach(async () => {
    // Create a recipient account
    recipient = await profile.accounts.acquire({ tier: 'MINIMAL' });
  });

  afterEach(async () => {
    await profile.accounts.release(recipient);
  });

  it(
    'should sign a scheduled transaction',
    async () => {
      // First, create a scheduled transaction using the operator
      const transferAmount = 0.1;
      const operatorClient = profile.client.connectAs(profile.operator).client;
      const operatorWrapper = new HederaOperationsWrapper(operatorClient);

      const transferParams: z.infer<ReturnType<typeof transferHbarParametersNormalised>> = {
        hbarTransfers: [
          {
            accountId: recipient.accountId,
            amount: transferAmount,
          },
          {
            accountId: executor.accountId,
            amount: -transferAmount,
          },
        ],
        schedulingParams: {
          isScheduled: true,
          adminKey: profile.operator.privateKey.publicKey as PublicKey,
        },
      };

      const scheduleTx = await operatorWrapper.transferHbar(transferParams);
      const scheduleId = scheduleTx.scheduleId!.toString();
      operatorClient.close();

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
    },
  );

  it(
    'should handle invalid schedule ID',
    async () => {
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
    },
  );
});
