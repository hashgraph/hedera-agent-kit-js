import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import {
  Client,
  PublicKey,
  TokenId,
  TokenSupplyType,
  TokenAllowance,
  Long,
} from '@hiero-ledger/sdk';
import { createLangchainTestSetup, LangchainTestSetup } from '@tests/utils';
import {
  getProfile,
  HederaOperationsWrapper,
  type TestAccount,
  wait,
  MIRROR_NODE_WAITING_TIME,
} from '@hashgraph/hedera-agent-kit-tests';
import { ResponseParserService } from '@hashgraph/hedera-agent-kit-langchain';
import { ReactAgent } from 'langchain';

describe('Delete Token Allowance E2E Tests', () => {
  const profile = getProfile();
  let testSetup: LangchainTestSetup;
  let agent: ReactAgent;
  let responseParsingService: ResponseParserService;
  let executor: TestAccount;
  let executorClient: Client;
  let executorWrapper: HederaOperationsWrapper;

  let spender: TestAccount;
  let spenderClient: Client;

  let tokenId: TokenId;

  const FT_PARAMS = {
    tokenName: 'E2EDeleteToken',
    tokenSymbol: 'DEL',
    tokenMemo: 'Token for E2E allowance delete tests',
    initialSupply: 1000,
    decimals: 2,
    maxSupply: 10000,
    supplyType: TokenSupplyType.Finite,
  };

  beforeAll(async () => {
    executor = await profile.accounts.acquire({ tier: 'STANDARD' });
    ({ client: executorClient, wrapper: executorWrapper } = profile.client.connectAs(executor));

    // Create fungible token under executor
    tokenId = await executorWrapper
      .createFungibleToken({
        ...FT_PARAMS,
        treasuryAccountId: executor.accountId.toString(),
        supplyKey: executor.privateKey.publicKey as PublicKey,
        adminKey: executor.privateKey.publicKey as PublicKey,
        autoRenewAccountId: executor.accountId.toString(),
      })
      .then(resp => resp.tokenId!);

    await wait(MIRROR_NODE_WAITING_TIME);

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

  beforeEach(async () => {
    spender = await profile.accounts.acquire({ tier: 'MINIMAL' });
    ({ client: spenderClient } = profile.client.connectAs(spender));
  });

  afterEach(async () => {
    await profile.accounts.release(spender);
    spenderClient?.close();
  });

  it('should delete an existing token allowance successfully', async () => {
    // Step 1: Approve a token allowance
    const approveParams = {
      tokenApprovals: [
        new TokenAllowance({
          tokenId: TokenId.fromString(tokenId.toString()),
          ownerAccountId: executor.accountId,
          spenderAccountId: spender.accountId,
          amount: Long.fromNumber(10),
        }),
      ],
    };
    await executorWrapper.approveTokenAllowance(approveParams);

    // Step 2: Delete the token allowance via natural language input
    const input = `Delete token allowance given from ${executor.accountId.toString()} to account ${spender.accountId.toString()} for token ${tokenId.toString()}`;
    const queryResult = await agent.invoke({
      messages: [
        {
          role: 'user',
          content: input,
        },
      ],
    });
    const parsedResponse = responseParsingService.parseNewToolMessages(queryResult);

    // Step 3: Validate response
    expect(parsedResponse).toBeDefined();
    expect(parsedResponse[0].parsedData.humanMessage).toContain(
      'Token allowance(s) deleted successfully',
    );
    expect(parsedResponse[0].parsedData.raw.status).toBe('SUCCESS');
  });

  it('should handle deleting a non-existent token allowance gracefully', async () => {
    // No prior approve step
    const input = `Delete token allowance given from ${executor.accountId.toString()} to account ${spender.accountId.toString()} for token ${tokenId.toString()}`;
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
      'Token allowance(s) deleted successfully',
    );
    expect(parsedResponse[0].parsedData.raw.status).toBe('SUCCESS');
  });
});
