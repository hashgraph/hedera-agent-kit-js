import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import { ReactAgent } from 'langchain';
import { createLangchainTestSetup, type LangchainTestSetup } from '@tests/utils';
import {
  getProfile,
  HederaOperationsWrapper,
  type TestAccount,
  wait,
  MIRROR_NODE_WAITING_TIME,
  itWithRetry,
} from '@hashgraph/hedera-agent-kit-tests';
import { ResponseParserService } from '@hashgraph/hedera-agent-kit-langchain';
import { Client } from '@hiero-ledger/sdk';
import { createERC20Parameters } from '@hashgraph/hedera-agent-kit';
import { z } from 'zod';

describe('Transfer ERC20 Token E2E Tests', () => {
  const profile = getProfile();
  let testSetup: LangchainTestSetup;
  let agent: ReactAgent;
  let responseParsingService: ResponseParserService;
  let executor: TestAccount;
  let executorClient: Client;
  let executorWrapper: HederaOperationsWrapper;
  let recipient: TestAccount;
  let testTokenAddress: string;
  let recipientAccountId: string;

  beforeAll(async () => {
    executor = await profile.accounts.acquire({ tier: 'MINIMAL' });
    ({ client: executorClient, wrapper: executorWrapper } = profile.client.connectAs(executor));

    recipient = await profile.accounts.acquire({ tier: 'MINIMAL' });
    recipientAccountId = recipient.accountId.toString();

    // 4. Start LangChain test setup with an executor account
    testSetup = await createLangchainTestSetup(undefined, undefined, executorClient);
    agent = testSetup.agent;
    responseParsingService = testSetup.responseParser;

    // 5. Create a test ERC20 token with initial supply
    const createParams: z.infer<ReturnType<typeof createERC20Parameters>> = {
      tokenName: 'TestTransferToken',
      tokenSymbol: 'TTT',
      decimals: 18,
      initialSupply: 1000,
    };

    const createResult = await executorWrapper.createERC20(createParams);

    if (!createResult.erc20Address) {
      throw new Error('Failed to create test ERC20 token for transfers');
    }

    testTokenAddress = createResult.erc20Address;
    await wait(MIRROR_NODE_WAITING_TIME);
  });

  afterAll(async () => {
    await profile.accounts.release(recipient);
    await profile.accounts.release(executor);
    testSetup?.cleanup();
    executorClient?.close();
  });

  it(
    'transfers ERC20 tokens to another account via natural language',
    itWithRetry(async () => {
      const input = `Transfer 10 ERC20 tokens ${testTokenAddress} to ${recipientAccountId}`;

      const result = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: input,
          },
        ],
      });
      const parsedResponse = responseParsingService.parseNewToolMessages(result);

      expect(parsedResponse).toBeDefined();
      expect(parsedResponse[0].parsedData.raw.status).toBe('SUCCESS');
      expect(parsedResponse[0].parsedData.raw.transactionId).toBeDefined();

      await wait(MIRROR_NODE_WAITING_TIME);
    }),
  );

  it(
    'handles various natural language variations for transfers',
    itWithRetry(async () => {
      const variations = [
        `Transfer 1 ERC20 token ${testTokenAddress} to ${recipientAccountId}`,
        `Send 5 ERC20 tokens ${testTokenAddress} to recipient ${recipientAccountId}`,
        `Transfer 2 ERC20 tokens of contract ${testTokenAddress} to address ${recipientAccountId}`,
      ];

      for (const input of variations) {
        const result = await agent.invoke({
          messages: [
            {
              role: 'user',
              content: input,
            },
          ],
        });
        const parsedResponse = responseParsingService.parseNewToolMessages(result);

        expect(parsedResponse).toBeDefined();
        expect(parsedResponse[0].parsedData.raw.status.toString()).toBe('SUCCESS');
        expect(parsedResponse[0].parsedData.raw.transactionId).toBeDefined();
      }
    }),
  );

  it(
    'schedules transfer of ERC20 tokens to another account via natural language',
    itWithRetry(async () => {
      const input = `Transfer 10 ERC20 tokens ${testTokenAddress} to ${recipientAccountId}. Schedule this transaction.`;

      const result = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: input,
          },
        ],
      });
      const parsedResponse = responseParsingService.parseNewToolMessages(result);

      expect(parsedResponse[0].parsedData.raw).toBeDefined();
      expect(parsedResponse[0].parsedData.raw.transactionId).toBeDefined();
      expect(parsedResponse[0].parsedData.raw.scheduleId).not.toBeNull();
      expect(parsedResponse[0].parsedData.humanMessage).toContain(
        'Scheduled transfer of ERC20 successfully.',
      );
    }),
  );
});
