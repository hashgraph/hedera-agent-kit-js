import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client, PrivateKey, AccountId } from '@hashgraph/sdk';
import { ReactAgent } from 'langchain';
import {
  getCustomClient,
  getOperatorClientForTests,
  HederaOperationsWrapper,
  createLangchainTestSetup,
  type LangchainTestSetup,
} from '../utils';
import { ResponseParserService } from '@/langchain';
import { wait } from '../utils/general-util';
import { COMPILED_ERC20_BYTECODE, MIRROR_NODE_WAITING_TIME } from '../utils/test-constants';
import { itWithRetry } from '../utils/retry-util';

describe('Get Contract Info E2E Tests', () => {
  let operatorClient: Client;
  let executorClient: Client;
  let executorAccountId: AccountId;
  let executorWrapper: HederaOperationsWrapper;
  let deployedContractId: string;
  let testSetup: LangchainTestSetup;
  let agent: ReactAgent;
  let responseParsingService: ResponseParserService;

  beforeAll(async () => {
    operatorClient = getOperatorClientForTests();
    const operatorWrapper = new HederaOperationsWrapper(operatorClient);

    // Create an executor account
    const executorKey = PrivateKey.generateED25519();
    executorAccountId = await operatorWrapper
      .createAccount({ key: executorKey.publicKey, initialBalance: 20 })
      .then(resp => resp.accountId!);

    executorClient = getCustomClient(executorAccountId, executorKey);
    executorWrapper = new HederaOperationsWrapper(executorClient);

    // Deploy ERC20 contract
    const deployment = await executorWrapper.deployERC20(COMPILED_ERC20_BYTECODE);
    deployedContractId = deployment.contractId!;

    await wait(MIRROR_NODE_WAITING_TIME); // wait for mirror node sync

    // LangChain setup
    testSetup = await createLangchainTestSetup(undefined, undefined, executorClient);
    agent = testSetup.agent;
    responseParsingService = testSetup.responseParser;
  });

  afterAll(async () => {
    // Cleanup: delete executor account
    if (executorWrapper) {
      await executorWrapper.deleteAccount({
        accountId: executorAccountId,
        transferAccountId: operatorClient.operatorAccountId!,
      });
    }
    if (testSetup) testSetup.cleanup();
    operatorClient.close();
    executorClient.close();
  });

  it(
    'should fetch contract info for a deployed contract via LangChain agent',
    itWithRetry(async () => {
      const input = `Get the contract info for contract ID ${deployedContractId}`;
      const queryResult = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: input,
          },
        ],
      });
      const parsedResponse = responseParsingService.parseNewToolMessages(queryResult);

      expect(parsedResponse[0].parsedData.raw.contractId).toBe(deployedContractId);
      expect(parsedResponse[0].parsedData.raw.contractInfo.contract_id).toBe(deployedContractId);
      expect(parsedResponse[0].parsedData.humanMessage).toContain(
        `details for contract **${deployedContractId}**`,
      );
    }),
  );

  it(
    'should handle non-existent contract gracefully via LangChain agent',
    itWithRetry(async () => {
      const fakeContractId = '0.0.999999999';
      const input = `Get the contract info for contract ID ${fakeContractId}`;
      const queryResult = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: input,
          },
        ],
      });
      const parsedResponse = responseParsingService.parseNewToolMessages(queryResult);

      expect(parsedResponse[0].parsedData.raw.error).toContain('Failed to get contract info');
      expect(parsedResponse[0].parsedData.humanMessage).toContain('Failed to get contract info');
    }),
  );
});
