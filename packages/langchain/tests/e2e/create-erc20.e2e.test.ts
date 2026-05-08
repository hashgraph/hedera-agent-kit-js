import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import { ReactAgent } from 'langchain';
import { createLangchainTestSetup, type LangchainTestSetup } from '@tests/utils';
import {
  getProfile,
  HederaOperationsWrapper,
  type TestAccount,
  waitForMirrorTx,
} from '@hashgraph/hedera-agent-kit-tests';
import { ResponseParserService } from '@hashgraph/hedera-agent-kit-langchain';
import { Client } from '@hiero-ledger/sdk';

describe('Create ERC20 Token E2E Tests', () => {
  const profile = getProfile();
  let testSetup: LangchainTestSetup;
  let agent: ReactAgent;
  let responseParsingService: ResponseParserService;
  let executor: TestAccount;
  let executorClient: Client;
  let executorWrapper: HederaOperationsWrapper;

  beforeAll(async () => {
    executor = await profile.accounts.acquire({ tier: 'STANDARD' });
    ({ client: executorClient, wrapper: executorWrapper } = profile.client.connectAs(executor));

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
    'creates an ERC20 token with minimal params via natural language',
    async () => {
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

      await waitForMirrorTx(executorWrapper, parsedResponse[0].parsedData.raw.transactionId);

      // Verify on-chain contract info
      const contractInfo = await executorWrapper.getContractInfo(erc20Address!);
      expect(contractInfo).toBeDefined();
    },
  );

  it(
    'creates an ERC20 token with decimals and initial supply',
    async () => {
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

      await waitForMirrorTx(executorWrapper, parsedResponse[0].parsedData.raw.transactionId);

      const contractInfo = await executorWrapper.getContractInfo(erc20Address!);
      expect(contractInfo).toBeDefined();
    },
  );

  it(
    'should schedule creation of erc20 token',
    async () => {
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
    },
  );
});
