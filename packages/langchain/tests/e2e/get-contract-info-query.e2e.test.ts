import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from '@hiero-ledger/sdk';
import { ReactAgent } from 'langchain';
import { createLangchainTestSetup, type LangchainTestSetup } from '@tests/utils';
import {
  getProfile,
  HederaOperationsWrapper,
  type TestAccount,
  waitForMirrorTx,
  COMPILED_ERC20_BYTECODE,
} from '@hashgraph/hedera-agent-kit-tests';
import { ResponseParserService } from '@hashgraph/hedera-agent-kit-langchain';

describe('Get Contract Info E2E Tests', () => {
  const profile = getProfile();
  let executor: TestAccount;
  let executorClient: Client;
  let executorWrapper: HederaOperationsWrapper;
  let deployedContractId: string;
  let testSetup: LangchainTestSetup;
  let agent: ReactAgent;
  let responseParsingService: ResponseParserService;

  beforeAll(async () => {
    executor = await profile.accounts.acquire({ tier: 'STANDARD' });
    ({ client: executorClient, wrapper: executorWrapper } = profile.client.connectAs(executor));

    // Deploy ERC20 contract
    const deployment = await executorWrapper.deployERC20(COMPILED_ERC20_BYTECODE);
    deployedContractId = deployment.contractId!;

    await waitForMirrorTx(executorWrapper, deployment.transactionId!); // wait for mirror node sync

    // LangChain setup
    testSetup = await createLangchainTestSetup(undefined, undefined, executorClient);
    agent = testSetup.agent;
    responseParsingService = testSetup.responseParser;
  });

  afterAll(async () => {
    await profile.accounts.release(executor);
    testSetup?.cleanup();
    executorClient?.close();
  });

  it(
    'should fetch contract info for a deployed contract via LangChain agent',
    async () => {
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
    },
  );

  it(
    'should handle non-existent contract gracefully via LangChain agent',
    async () => {
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
    },
  );
});
