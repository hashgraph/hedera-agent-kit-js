import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import { AgentExecutor } from 'langchain/agents';
import {
  createLangchainTestSetup,
  HederaOperationsWrapper,
  type LangchainTestSetup,
  getOperatorClientForTests,
  getCustomClient,
} from '../utils';
import { AccountId, Client, PrivateKey } from '@hashgraph/sdk';
import { extractObservationFromLangchainResponse, wait } from '../utils/general-util';
import { returnHbarsAndDeleteAccount } from '../utils/teardown/account-teardown';
import { MIRROR_NODE_WAITING_TIME } from '../utils/test-constants';
import { createERC20Parameters } from '@/shared/parameter-schemas/evm.zod';
import { z } from 'zod';
import { itWithRetry } from '../utils/retry-util';

describe('Transfer ERC20 Token E2E Tests', () => {
  let testSetup: LangchainTestSetup;
  let agentExecutor: AgentExecutor;
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
      .createAccount({ key: executorAccountKey.publicKey, initialBalance: 20 })
      .then(resp => resp.accountId!);

    // 2. Create a recipient account (with the same public key as the executor for simplicity)
    recipientAccountId = await operatorWrapper
      .createAccount({ key: executorAccountKey.publicKey, initialBalance: 0 })
      .then(resp => resp.accountId!.toString());

    // 3. Build executor client
    executorClient = getCustomClient(executorAccountId, executorAccountKey);

    // 4. Start LangChain test setup with an executor account
    testSetup = await createLangchainTestSetup(undefined, undefined, executorClient);
    agentExecutor = testSetup.agentExecutor;
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

      const result = await agentExecutor.invoke({ input });
      const observation = extractObservationFromLangchainResponse(result);

      expect(observation).toBeDefined();
      expect(observation.raw.status).toBe('SUCCESS');
      expect(observation.raw.transactionId).toBeDefined();

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
        const result = await agentExecutor.invoke({ input });
        const observation = extractObservationFromLangchainResponse(result);

        expect(observation).toBeDefined();
        expect(observation.raw.status.toString()).toBe('SUCCESS');
        expect(observation.raw.transactionId).toBeDefined();
      }
    }),
  );

  it(
    'schedules transfer of ERC20 tokens to another account via natural language',
    itWithRetry(async () => {
      const input = `Transfer 10 ERC20 tokens ${testTokenAddress} to ${recipientAccountId}. Schedule this transaction.`;

      const result = await agentExecutor.invoke({ input });
      const observation = extractObservationFromLangchainResponse(result);

      expect(observation.raw).toBeDefined();
      expect(observation.raw.transactionId).toBeDefined();
      expect(observation.raw.scheduleId).not.toBeNull();
      expect(observation.humanMessage).toContain('Scheduled transfer of ERC20 successfully.');
    }),
  );
});
