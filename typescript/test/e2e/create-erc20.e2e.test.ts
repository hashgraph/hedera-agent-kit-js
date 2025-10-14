import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import { AgentExecutor } from 'langchain/agents';
import {
  createLangchainTestSetup,
  HederaOperationsWrapper,
  type LangchainTestSetup,
  getOperatorClientForTests,
  getCustomClient,
} from '../utils';
import { Client, PrivateKey } from '@hashgraph/sdk';
import { extractObservationFromLangchainResponse, wait } from '../utils/general-util';
import { returnHbarsAndDeleteAccount } from '../utils/teardown/account-teardown';
import { MIRROR_NODE_WAITING_TIME } from '../utils/test-constants';
import { itWithRetry } from '../utils/retry-util';

describe('Create ERC20 Token E2E Tests', () => {
  let testSetup: LangchainTestSetup;
  let agentExecutor: AgentExecutor;
  let executorClient: Client;
  let operatorClient: Client;
  let executorWrapper: HederaOperationsWrapper;

  beforeAll(async () => {
    operatorClient = getOperatorClientForTests();
    const operatorWrapper = new HederaOperationsWrapper(operatorClient);

    // 1. Create an executor account (funded by operator)
    const executorAccountKey = PrivateKey.generateED25519();
    const executorAccountId = await operatorWrapper
      .createAccount({ key: executorAccountKey.publicKey, initialBalance: 10 })
      .then(resp => resp.accountId!);

    // 2. Build executor client
    executorClient = getCustomClient(executorAccountId, executorAccountKey);

    // 3. Start LangChain test setup with an executor account
    testSetup = await createLangchainTestSetup(undefined, undefined, executorClient);
    agentExecutor = testSetup.agentExecutor;
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

      const result = await agentExecutor.invoke({ input });
      const observation = extractObservationFromLangchainResponse(result);
      const erc20Address = observation.erc20Address;

      expect(observation).toBeDefined();
      expect(observation.humanMessage).toContain('ERC20 token created successfully');
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

      const result = await agentExecutor.invoke({ input });
      const observation = extractObservationFromLangchainResponse(result);
      const erc20Address = observation.erc20Address;

      expect(observation).toBeDefined();
      expect(observation.humanMessage).toContain('ERC20 token created successfully');
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

      const result = await agentExecutor.invoke({ input });
      const observation = extractObservationFromLangchainResponse(result);

      // Validate response structure
      expect(observation.raw).toBeDefined();
      expect(observation.raw.transactionId).toBeDefined();
      expect(observation.raw.scheduleId).toBeDefined();
      expect(observation.humanMessage).toContain('Scheduled creation of ERC20 successfully.');
    }),
  );
});
