import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  AccountId,
  Client,
  Key,
  PrivateKey,
  PublicKey,
  TokenId,
  TokenSupplyType,
} from '@hashgraph/sdk';
import { AgentExecutor } from 'langchain/agents';
import {
  createLangchainTestSetup,
  getCustomClient,
  getOperatorClientForTests,
  HederaOperationsWrapper,
  LangchainTestSetup,
} from '../utils';
import { MIRROR_NODE_WAITING_TIME } from '../utils/test-constants';
import { extractObservationFromLangchainResponse, wait } from '../utils/general-util';
import { returnHbarsAndDeleteAccount } from '../utils/teardown/account-teardown';

/**
 * E2E tests for Approve Token Allowance using the LangChain agent.
 * Flow mirrors HBAR allowance E2E with token setup:
 * 1. Operator funds an executor (owner) account used by the agent.
 * 2. Create a spender account.
 * 3. Create a temporary fungible token with executor as treasury/supply key.
 * 4. Ask the agent (running as executor) to approve an allowance for that token to the spender.
 */

describe('Approve Token Allowance E2E Tests with Intermediate Execution Account', () => {
  let testSetup: LangchainTestSetup;
  let agentExecutor: AgentExecutor;
  let operatorClient: Client;
  let executorClient: Client; // acts as an owner
  let operatorWrapper: HederaOperationsWrapper;
  let executorWrapper: HederaOperationsWrapper;

  let spenderAccount: AccountId;
  let spenderKey: PrivateKey;

  let tokenId: TokenId;

  beforeAll(async () => {
    operatorClient = getOperatorClientForTests();
    operatorWrapper = new HederaOperationsWrapper(operatorClient);

    // execution account and client creation (owner)
    const executorKey = PrivateKey.generateED25519();
    const executorAccountId = await operatorWrapper
      .createAccount({ key: executorKey.publicKey, initialBalance: 20 })
      .then(resp => resp.accountId!);

    executorClient = getCustomClient(executorAccountId, executorKey);
    executorWrapper = new HederaOperationsWrapper(executorClient);

    // langchain setup with execution account
    testSetup = await createLangchainTestSetup(undefined, undefined, executorClient);
    agentExecutor = testSetup.agentExecutor;

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
        supplyKey: executorClient.operatorPublicKey! as PublicKey,
        adminKey: executorClient.operatorPublicKey! as PublicKey,
        treasuryAccountId: executorAccountId.toString(),
        autoRenewAccountId: executorAccountId.toString(),
      })
      .then(resp => resp.tokenId!);

    await wait(MIRROR_NODE_WAITING_TIME);
  });

  afterAll(async () => {
    if (testSetup && operatorClient) {
      await returnHbarsAndDeleteAccount(
        executorWrapper,
        executorClient.operatorAccountId!,
        operatorClient.operatorAccountId!,
      );
      testSetup.cleanup();
      operatorClient.close();
    }
  });

  beforeEach(async () => {
    // Create a spender account
    spenderKey = PrivateKey.generateED25519();
    spenderAccount = await executorWrapper
      .createAccount({ key: spenderKey.publicKey as Key, initialBalance: 0 })
      .then(resp => resp.accountId!);
  });

  it('should approve fungible token allowance to spender (with memo)', async () => {
    const memo = 'E2E token allow memo';
    const input = `Approve allowance of 25 for token ${tokenId.toString()} to ${spenderAccount.toString()} with memo "${memo}"`;
    const transactionResult = await agentExecutor.invoke({ input });
    const ownerAccountId = executorClient.operatorAccountId!;
    const observation = extractObservationFromLangchainResponse(transactionResult);

    // We just assert that the agent ran without throwing. Detailed SUCCESS assertions are part of integration tests.
    expect(observation.raw.status).toBe('SUCCESS');
    expect(observation.humanMessage).toContain(
      'Fungible token allowance(s) approved successfully. Transaction ID:',
    );

    await wait(MIRROR_NODE_WAITING_TIME);

    const allowances = await executorWrapper.getTokenAllowances(
      ownerAccountId.toString(),
      spenderAccount.toString(),
    );

    expect(allowances.allowances.find(a => a.owner === ownerAccountId.toString())).toBeTruthy();
  });
});
