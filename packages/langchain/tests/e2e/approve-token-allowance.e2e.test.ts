import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Client, PublicKey, TokenId, TokenSupplyType } from '@hiero-ledger/sdk';
import { ReactAgent } from 'langchain';
import { createLangchainTestSetup, LangchainTestSetup } from '@tests/utils';
import {
  getProfile,
  HederaOperationsWrapper,
  type TestAccount,
  wait,
  MIRROR_NODE_WAITING_TIME,
} from '@hashgraph/hedera-agent-kit-tests';
import { ResponseParserService } from '@hashgraph/hedera-agent-kit-langchain';

/**
 * E2E tests for Approve Token Allowance using the LangChain agent.
 * Flow mirrors HBAR allowance E2E with token setup:
 * 1. Operator funds an executor (owner) account used by the agent.
 * 2. Create a spender account.
 * 3. Create a temporary fungible token with executor as treasury/supply key.
 * 4. Ask the agent (running as executor) to approve an allowance for that token to the spender.
 */

describe('Approve Token Allowance E2E Tests with Intermediate Execution Account', () => {
  const profile = getProfile();
  let testSetup: LangchainTestSetup;
  let agent: ReactAgent;
  let responseParsingService: ResponseParserService;
  let executor: TestAccount; // acts as an owner
  let executorClient: Client;
  let executorWrapper: HederaOperationsWrapper;

  let spender: TestAccount;

  let tokenId: TokenId;

  beforeAll(async () => {
    executor = await profile.accounts.acquire({
      tier: 'STANDARD',
      accountMemo: 'executor account for Approve Token Allowance E2E Tests',
    });
    ({ client: executorClient, wrapper: executorWrapper } = profile.client.connectAs(executor));

    // langchain setup with execution account
    testSetup = await createLangchainTestSetup(undefined, undefined, executorClient);
    agent = testSetup.agent;
    responseParsingService = testSetup.responseParser;

    // create test fungible token
    tokenId = await executorWrapper
      .createFungibleToken({
        tokenName: 'E2EAllowToken',
        tokenSymbol: 'E2EALW',
        tokenMemo: 'FT',
        initialSupply: 1000,
        decimals: 2,
        maxSupply: 100000,
        supplyType: TokenSupplyType.Finite,
        supplyKey: executor.privateKey.publicKey as PublicKey,
        adminKey: executor.privateKey.publicKey as PublicKey,
        treasuryAccountId: executor.accountId.toString(),
        autoRenewAccountId: executor.accountId.toString(),
      })
      .then(resp => resp.tokenId!);

    await wait(MIRROR_NODE_WAITING_TIME);
  });

  afterAll(async () => {
    if (spender) {
      await profile.accounts.release(spender);
    }
    await profile.accounts.release(executor);
    testSetup?.cleanup();
    executorClient?.close();
  });

  beforeEach(async () => {
    spender = await profile.accounts.acquire({
      tier: 'MINIMAL',
      accountMemo: 'spender account for Approve Token Allowance E2E Tests',
    });
  });

  it('should approve fungible token allowance to spender (with memo)', async () => {
    const memo = 'E2E token allow memo';
    const input = `Approve allowance of 25 for token ${tokenId.toString()} to ${spender.accountId.toString()} with memo "${memo}"`;
    const transactionResult = await agent.invoke({
      messages: [
        {
          role: 'user',
          content: input,
        },
      ],
    });
    const ownerAccountId = executor.accountId;
    const parsedResponse = responseParsingService.parseNewToolMessages(transactionResult);

    // We just assert that the agent ran without throwing. Detailed SUCCESS assertions are part of integration tests.
    expect(parsedResponse[0].parsedData.raw.status).toBe('SUCCESS');
    expect(parsedResponse[0].parsedData.humanMessage).toContain(
      'Fungible token allowance(s) approved successfully. Transaction ID:',
    );

    await wait(MIRROR_NODE_WAITING_TIME);

    const allowances = await executorWrapper.getTokenAllowances(
      ownerAccountId.toString(),
      spender.accountId.toString(),
    );

    expect(allowances.allowances.find(a => a.owner === ownerAccountId.toString())).toBeTruthy();
  });
});
