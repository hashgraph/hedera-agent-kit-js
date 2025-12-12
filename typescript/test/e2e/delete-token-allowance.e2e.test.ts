import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import {
  Client,
  PrivateKey,
  AccountId,
  PublicKey,
  TokenId,
  TokenSupplyType,
  TokenAllowance,
  Long,
} from '@hashgraph/sdk';
import {
  createLangchainTestSetup,
  getCustomClient,
  getOperatorClientForTests,
  HederaOperationsWrapper,
  LangchainTestSetup,
} from '../utils';
import { ResponseParserService } from '@/langchain';
import { returnHbarsAndDeleteAccount } from '../utils/teardown/account-teardown';
import { ReactAgent } from 'langchain';
import { wait } from '../utils/general-util';
import { MIRROR_NODE_WAITING_TIME } from '../utils/test-constants';
import { UsdToHbarService } from '../utils/usd-to-hbar-service';

describe('Delete Token Allowance E2E Tests', () => {
  let testSetup: LangchainTestSetup;
  let agent: ReactAgent;
  let responseParsingService: ResponseParserService;
  let operatorClient: Client;
  let executorClient: Client;
  let executorAccountId: AccountId;
  let executorWrapper: HederaOperationsWrapper;

  let spenderAccountId: AccountId;
  let spenderKey: PrivateKey;
  let spenderClient: Client;
  let spenderWrapper: HederaOperationsWrapper;

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
    operatorClient = getOperatorClientForTests();
    const operatorWrapper = new HederaOperationsWrapper(operatorClient);

    // Create executor (owner)
    const executorKey = PrivateKey.generateED25519();
    executorAccountId = await operatorWrapper
      .createAccount({ key: executorKey.publicKey, initialBalance: UsdToHbarService.usdToHbar(3.00) })
      .then(resp => resp.accountId!);

    executorClient = getCustomClient(executorAccountId, executorKey);
    executorWrapper = new HederaOperationsWrapper(executorClient);

    // Create fungible token under executor
    tokenId = await executorWrapper
      .createFungibleToken({
        ...FT_PARAMS,
        treasuryAccountId: executorAccountId.toString(),
        supplyKey: executorClient.operatorPublicKey as PublicKey,
        adminKey: executorClient.operatorPublicKey as PublicKey,
        autoRenewAccountId: executorAccountId.toString(),
      })
      .then(resp => resp.tokenId!);

    await wait(MIRROR_NODE_WAITING_TIME);

    // LangChain setup
    testSetup = await createLangchainTestSetup(undefined, undefined, executorClient);
    agent = testSetup.agent;
    responseParsingService = testSetup.responseParser;
  });

  afterAll(async () => {
    if (executorClient && operatorClient) {
      await returnHbarsAndDeleteAccount(
        executorWrapper,
        executorAccountId,
        operatorClient.operatorAccountId!,
      );
      executorClient.close();
      operatorClient.close();
    }
  });

  beforeEach(async () => {
    // Create spender account before each test
    spenderKey = PrivateKey.generateED25519();
    spenderAccountId = await executorWrapper
      .createAccount({
        key: spenderKey.publicKey,
        initialBalance: UsdToHbarService.usdToHbar(0.35),
      })
      .then(resp => resp.accountId!);

    spenderClient = getCustomClient(spenderAccountId, spenderKey);
    spenderWrapper = new HederaOperationsWrapper(spenderClient);
  });

  afterEach(async () => {
    if (spenderAccountId) {
      await spenderWrapper.deleteAccount({
        accountId: spenderAccountId,
        transferAccountId: executorAccountId,
      });
    }
  });

  it('should delete an existing token allowance successfully', async () => {
    // Step 1: Approve a token allowance
    const approveParams = {
      tokenApprovals: [
        new TokenAllowance({
          tokenId: TokenId.fromString(tokenId.toString()),
          ownerAccountId: executorAccountId,
          spenderAccountId: spenderAccountId,
          amount: Long.fromNumber(10),
        }),
      ],
    };
    await executorWrapper.approveTokenAllowance(approveParams);

    // Step 2: Delete the token allowance via natural language input
    const input = `Delete token allowance given from ${executorAccountId.toString()} to account ${spenderAccountId.toString()} for token ${tokenId.toString()}`;
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
    const input = `Delete token allowance given from ${executorAccountId.toString()} to account ${spenderAccountId.toString()} for token ${tokenId.toString()}`;
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
