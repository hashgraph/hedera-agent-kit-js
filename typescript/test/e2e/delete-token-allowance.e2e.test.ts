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
import { returnHbarsAndDeleteAccount } from '../utils/teardown/account-teardown';
import { AgentExecutor } from 'langchain/agents';
import { extractObservationFromLangchainResponse, wait } from '../utils/general-util';
import { MIRROR_NODE_WAITING_TIME } from '../utils/test-constants';

describe('Delete Token Allowance E2E Tests', () => {
  let testSetup: LangchainTestSetup;
  let agentExecutor: AgentExecutor;
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
      .createAccount({ key: executorKey.publicKey, initialBalance: 50 })
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
    agentExecutor = testSetup.agentExecutor;
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
        initialBalance: 5,
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
    const queryResult = await agentExecutor.invoke({ input });
    const observation = extractObservationFromLangchainResponse(queryResult);

    // Step 3: Validate response
    expect(observation).toBeDefined();
    expect(observation.humanMessage).toContain('Token allowance(s) deleted successfully');
    expect(observation.raw.status).toBe('SUCCESS');
  });

  it('should handle deleting a non-existent token allowance gracefully', async () => {
    // No prior approve step
    const input = `Delete token allowance given from ${executorAccountId.toString()} to account ${spenderAccountId.toString()} for token ${tokenId.toString()}`;
    const queryResult = await agentExecutor.invoke({ input });
    const observation = extractObservationFromLangchainResponse(queryResult);

    expect(observation).toBeDefined();
    expect(observation.humanMessage).toContain('Token allowance(s) deleted successfully');
    expect(observation.raw.status).toBe('SUCCESS');
  });
});
