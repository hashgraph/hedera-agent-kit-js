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
import { Client, PrivateKey } from '@hashgraph/sdk';
import { wait } from '../utils/general-util';
import { returnHbarsAndDeleteAccount } from '../utils/teardown/account-teardown';
import { MIRROR_NODE_WAITING_TIME } from '../utils/test-constants';
import { itWithRetry } from '../utils/retry-util';
import { UsdToHbarService } from '../utils/usd-to-hbar-service';
import { BALANCE_TIERS } from '../utils/setup/langchain-test-config';

describe('Create ERC20 Token E2E Tests', () => {
  let testSetup: LangchainTestSetup;
  let agent: ReactAgent;
  let responseParsingService: ResponseParserService;
  let executorClient: Client;
  let operatorClient: Client;
  let executorWrapper: HederaOperationsWrapper;

  beforeAll(async () => {
    operatorClient = getOperatorClientForTests();
    const operatorWrapper = new HederaOperationsWrapper(operatorClient);

    // 1. Create an executor account (funded by operator)
    const executorAccountKey = PrivateKey.generateED25519();
    const executorAccountId = await operatorWrapper
      .createAccount({ key: executorAccountKey.publicKey, initialBalance: UsdToHbarService.usdToHbar(BALANCE_TIERS.STANDARD) })
      .then(resp => resp.accountId!);

    // 2. Build executor client
    executorClient = getCustomClient(executorAccountId, executorAccountKey);

    // 3. Start LangChain test setup with an executor account
    testSetup = await createLangchainTestSetup(undefined, undefined, executorClient);
    agent = testSetup.agent;
    responseParsingService = testSetup.responseParser;
    executorWrapper = new HederaOperationsWrapper(executorClient);

    await wait(MIRROR_NODE_WAITING_TIME);
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
    'creates an ERC20 token with minimal params via natural language',
    itWithRetry(async () => {
      const input = 'Create an ERC20 token named MyERC20 with symbol M20';

      const result = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: input,
          },
        ],
      });
      const parsedResponse = responseParsingService.parseNewToolMessages(result);
      const erc20Address = parsedResponse[0].parsedData.raw.erc20Address;

      expect(parsedResponse[0].parsedData).toBeDefined();
      expect(parsedResponse[0].parsedData.humanMessage).toContain(
        'ERC20 token created successfully',
      );
      expect(erc20Address).toBeDefined();

      await wait(MIRROR_NODE_WAITING_TIME);

      // Verify on-chain contract info
      const contractInfo = await executorWrapper.getContractInfo(erc20Address!);
      expect(contractInfo).toBeDefined();
    }),
  );

  it(
    'creates an ERC20 token with decimals and initial supply',
    itWithRetry(async () => {
      const input =
        'Create an ERC20 token GoldToken with symbol GLD, decimals 2, initial supply 1000';

      const result = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: input,
          },
        ],
      });

      const parsedResponse = responseParsingService.parseNewToolMessages(result);
      const erc20Address = parsedResponse[0].parsedData.raw.erc20Address;

      expect(parsedResponse[0].parsedData).toBeDefined();
      expect(parsedResponse[0].parsedData.humanMessage).toContain(
        'ERC20 token created successfully',
      );
      expect(erc20Address).toBeDefined();

      await wait(MIRROR_NODE_WAITING_TIME);

      const contractInfo = await executorWrapper.getContractInfo(erc20Address!);
      expect(contractInfo).toBeDefined();
    }),
  );

  it(
    'should schedule creation of erc20 token',
    itWithRetry(async () => {
      const name = `MyERC20-${new Date().getTime().toString()}`;
      const input = `Create an ERC20 token named "${name}" with symbol M20. Schedule this transaction instead of executing it immediately.`;

      const result = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: input,
          },
        ],
      });
      const parsedResponse = responseParsingService.parseNewToolMessages(result);

      // Validate response structure
      expect(parsedResponse[0].parsedData.raw).toBeDefined();
      expect(parsedResponse[0].parsedData.raw.transactionId).toBeDefined();
      expect(parsedResponse[0].parsedData.raw.scheduleId).toBeDefined();
      expect(parsedResponse[0].parsedData.humanMessage).toContain(
        'Scheduled creation of ERC20 successfully.',
      );
    }),
  );
});
