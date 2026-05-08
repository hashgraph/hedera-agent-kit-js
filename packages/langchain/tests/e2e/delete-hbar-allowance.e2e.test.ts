import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { Client, Hbar, HbarUnit, HbarAllowance } from '@hiero-ledger/sdk';
import { z } from 'zod';
import { createLangchainTestSetup, LangchainTestSetup } from '@tests/utils';
import {
  getProfile,
  HederaOperationsWrapper,
  type TestAccount,
} from '@hashgraph/hedera-agent-kit-tests';
import { ResponseParserService } from '@hashgraph/hedera-agent-kit-langchain';
import { approveHbarAllowanceParametersNormalised } from '@hashgraph/hedera-agent-kit';
import { ReactAgent } from 'langchain';

describe('Delete HBAR Allowance Integration Tests', () => {
  const profile = getProfile();
  let testSetup: LangchainTestSetup;
  let agent: ReactAgent;
  let responseParsingService: ResponseParserService;
  let executor: TestAccount;
  let executorClient: Client;
  let executorWrapper: HederaOperationsWrapper;

  let spender: TestAccount;
  let spenderClient: Client;

  beforeAll(async () => {
    executor = await profile.accounts.acquire({ tier: 'STANDARD' });
    ({ client: executorClient, wrapper: executorWrapper } = profile.client.connectAs(executor));

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
    spender = await profile.accounts.acquire({ tier: 'MINIMAL' });
    ({ client: spenderClient } = profile.client.connectAs(spender));
  });

  afterEach(async () => {
    await profile.accounts.release(spender);
    spenderClient?.close();
  });

  it('should delete an existing allowance and prevent further spending', async () => {
    const allowanceAmount = 1.5;

    // Step 1: Approve allowance
    const approveParams: z.infer<ReturnType<typeof approveHbarAllowanceParametersNormalised>> = {
      hbarApprovals: [
        new HbarAllowance({
          ownerAccountId: executor.accountId,
          spenderAccountId: spender.accountId,
          amount: Hbar.from(allowanceAmount, HbarUnit.Hbar),
        }),
      ],
    };
    await executorWrapper.approveHbarAllowance(approveParams);

    // Step 3: Delete allowance via tool (no amount param!)
    const input = `Delete HBAR allowance from ${executor.accountId.toString()} to ${spender.accountId.toString()}`;
    const queryResult = await agent.invoke({
      messages: [
        {
          role: 'user',
          content: input,
        },
      ],
    });
    const parsedResponse = responseParsingService.parseNewToolMessages(queryResult);

    expect(parsedResponse).toBeDefined();
    expect(parsedResponse[0].parsedData.humanMessage).toContain(
      'HBAR allowance deleted successfully',
    );
  });

  it('should handle deleting a non-existent allowance gracefully', async () => {
    // No approve step -> directly delete
    const input = `Delete HBAR allowance from ${executor.accountId.toString()} to ${spender.accountId.toString()}`;
    const queryResult = await agent.invoke({
      messages: [
        {
          role: 'user',
          content: input,
        },
      ],
    });
    const parsedResponse = responseParsingService.parseNewToolMessages(queryResult);

    expect(parsedResponse).toBeDefined();
    expect(parsedResponse[0].parsedData.humanMessage).toContain(
      'HBAR allowance deleted successfully',
    );
  });
});
