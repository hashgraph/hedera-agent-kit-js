import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import { ReactAgent } from 'langchain';
import {
  createLangchainTestSetup,
  HederaOperationsWrapper,
  type LangchainTestSetup,
  getOperatorClientForTests,
  getCustomClient,
} from '../utils';
import { ResponseParserService } from '@/langchain';
import { AccountId, Client, PrivateKey } from '@hashgraph/sdk';
import { wait } from '../utils/general-util';
import { returnHbarsAndDeleteAccount } from '../utils/teardown/account-teardown';
import { MIRROR_NODE_WAITING_TIME } from '../utils/test-constants';
import { createERC20Parameters } from '@/shared/parameter-schemas/evm.zod';
import { z } from 'zod';
import { itWithRetry } from '../utils/retry-util';
import { UsdToHbarService } from '../utils/usd-to-hbar-service';

describe('Transfer ERC20 Token E2E Tests', () => {
  let testSetup: LangchainTestSetup;
  let agent: ReactAgent;
  let responseParsingService: ResponseParserService;
  let executorClient: Client;
  let operatorClient: Client;
  let executorWrapper: HederaOperationsWrapper;
  let testTokenAddress: string;
  let recipientAccountId: string;

  beforeAll(async () => {
    operatorClient = getOperatorClientForTests();
    const operatorWrapper = new HederaOperationsWrapper(operatorClient);

    // 1. Create an executor account (funded by operator)
    const executorAccountKey = PrivateKey.generateED25519();
    const executorAccountId = await operatorWrapper
      .createAccount({ key: executorAccountKey.publicKey, initialBalance: UsdToHbarService.usdToHbar(0.60) })
      .then(resp => resp.accountId!);

    // 2. Create a recipient account (with the same public key as the executor for simplicity)
    recipientAccountId = await operatorWrapper
      .createAccount({ key: executorAccountKey.publicKey, initialBalance: 0 })
      .then(resp => resp.accountId!.toString());

    // 3. Build executor client
    executorClient = getCustomClient(executorAccountId, executorAccountKey);

    // 4. Start LangChain test setup with an executor account
    testSetup = await createLangchainTestSetup(undefined, undefined, executorClient);
    agent = testSetup.agent;
    responseParsingService = testSetup.responseParser;
    executorWrapper = new HederaOperationsWrapper(executorClient);

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
    if (operatorClient && executorClient) {
      await returnHbarsAndDeleteAccount(
        executorWrapper,
        AccountId.fromString(recipientAccountId),
        operatorClient.operatorAccountId!,
      );
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
        `Transfer 2 tokens of contract ${testTokenAddress} to address ${recipientAccountId}`,
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
