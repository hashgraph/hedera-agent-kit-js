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
import { extractObservationFromLangchainResponse, wait } from '../utils/general-util';
import { returnHbarsAndDeleteAccount } from '../utils/teardown/account-teardown';
import { AgentExecutor } from 'langchain/agents';
import { MIRROR_NODE_WAITING_TIME } from '../utils/test-constants';
import { itWithRetry } from '../utils/retry-util';

describe('Transfer Fungible Token With Allowance E2E Tests', () => {
  let testSetup: LangchainTestSetup;
  let agentExecutor: AgentExecutor;
  let operatorWrapper: HederaOperationsWrapper;

  let operatorClient: Client;
  let executorClient: Client;
  let executorAccountId: AccountId;
  let executorWrapper: HederaOperationsWrapper;

  let spenderClient: Client;
  let spenderAccountId: AccountId;
  let spenderKey: PrivateKey;
  let spenderWrapper: HederaOperationsWrapper;

  let receiverClient: Client;
  let receiverAccountId: AccountId;
  let receiverKey: PrivateKey;
  let receiverWrapper: HederaOperationsWrapper;

  let tokenId: TokenId;

  const FT_PARAMS = {
    tokenName: 'E2EAllowanceToken',
    tokenSymbol: 'E2EAT',
    tokenMemo: 'Token for E2E allowance transfer tests',
    initialSupply: 1000,
    decimals: 0,
    maxSupply: 10000,
    supplyType: TokenSupplyType.Finite,
  };

  beforeAll(async () => {
    operatorClient = getOperatorClientForTests();
    operatorWrapper = new HederaOperationsWrapper(operatorClient);

    // Create an executor account (token owner)
    const executorKey = PrivateKey.generateED25519();
    executorAccountId = await operatorWrapper
      .createAccount({ key: executorKey.publicKey, initialBalance: 100 })
      .then(r => r.accountId!);

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
      .then(r => r.tokenId!);
  });

  afterAll(async () => {
    // Cleanup executor
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
    // Spender account
    spenderKey = PrivateKey.generateECDSA();
    spenderAccountId = await operatorWrapper
      .createAccount({ key: spenderKey.publicKey, initialBalance: 20 })
      .then(r => r.accountId!);

    spenderClient = getCustomClient(spenderAccountId, spenderKey);
    spenderWrapper = new HederaOperationsWrapper(spenderClient);

    // Receiver account
    receiverKey = PrivateKey.generateECDSA();
    receiverAccountId = await operatorWrapper
      .createAccount({ key: receiverKey.publicKey, initialBalance: 20 })
      .then(r => r.accountId!);

    receiverClient = getCustomClient(receiverAccountId, receiverKey);
    receiverWrapper = new HederaOperationsWrapper(receiverClient);

    // Associate token to spender and receiver
    await spenderWrapper.associateToken({
      accountId: spenderAccountId.toString(),
      tokenId: tokenId.toString(),
    });
    await receiverWrapper.associateToken({
      accountId: receiverAccountId.toString(),
      tokenId: tokenId.toString(),
    });

    // Approve allowance for spender
    await executorWrapper.approveTokenAllowance({
      tokenApprovals: [
        new TokenAllowance({
          tokenId,
          ownerAccountId: executorAccountId,
          spenderAccountId,
          amount: Long.fromNumber(200),
        }),
      ],
    });

    // Setup LangChain agent with spender client
    testSetup = await createLangchainTestSetup(undefined, undefined, spenderClient);
    agentExecutor = testSetup.agentExecutor;
  });

  afterEach(async () => {
    if (spenderAccountId) {
      await returnHbarsAndDeleteAccount(spenderWrapper, spenderAccountId, executorAccountId);
    }
    if (receiverAccountId) {
      await returnHbarsAndDeleteAccount(receiverWrapper, receiverAccountId, executorAccountId);
    }
  });

  it('should allow spender to transfer tokens to themselves using allowance', async () => {
    console.log(
      `Account ids: ${executorAccountId.toString()}, ${spenderAccountId.toString()}, ${receiverAccountId.toString()}`,
    );
    const input = `Use allowance from account ${executorAccountId.toString()} to send 50 ${tokenId.toString()} to account ${spenderAccountId.toString()}`;
    const result = await agentExecutor.invoke({ input });
    const observation = extractObservationFromLangchainResponse(result);

    expect(observation.humanMessage).toContain(
      'Fungible tokens successfully transferred with allowance',
    );
    expect(observation.raw.status).toBe('SUCCESS');

    await wait(MIRROR_NODE_WAITING_TIME);

    // FIXME: the xyzWrapper.getAccountTokenBalance() calls are failing with INVALID_ACCOUNT_ID and tx id 0.0.0@...
    // using mirrornode instead is a workaround
    const spenderBalance = await spenderWrapper.getAccountTokenBalanceFromMirrornode(
      spenderAccountId.toString(),
      tokenId.toString(),
    );

    expect(spenderBalance.balance).toBe(50);
  });

  it('should allow spender to transfer tokens to both themselves and receiver in one allowance call', async () => {
    const input = `Use allowance from account ${executorAccountId.toString()} to send 30 ${tokenId.toString()} to account ${spenderAccountId.toString()} and 70 ${tokenId.toString()} to account ${receiverAccountId.toString()}`;
    const result = await agentExecutor.invoke({ input });
    const observation = extractObservationFromLangchainResponse(result);

    expect(observation.humanMessage).toContain(
      'Fungible tokens successfully transferred with allowance',
    );
    expect(observation.raw.status).toBe('SUCCESS');

    await wait(MIRROR_NODE_WAITING_TIME);

    // FIXME: the xyzWrapper.getAccountTokenBalance() calls are failing with INVALID_ACCOUNT_ID and tx id 0.0.0@...
    // using mirrornode instead is a workaround
    const spenderBalance = await spenderWrapper.getAccountTokenBalanceFromMirrornode(
      spenderAccountId.toString(),
      tokenId.toString(),
    );
    const receiverBalance = await receiverWrapper.getAccountTokenBalanceFromMirrornode(
      receiverAccountId.toString(),
      tokenId.toString(),
    );

    expect(spenderBalance.balance).toBe(30);
    expect(receiverBalance.balance).toBe(70);
  });

  it(
    'should schedule allowing spender to transfer tokens to themselves using allowance',
    itWithRetry(async () => {
      const updateResult = await agentExecutor.invoke({
        input: `Use allowance from account ${executorAccountId.toString()} to send 50 ${tokenId.toString()} to account ${spenderAccountId.toString()}. Schedule the transaction instead of executing it immediately.`,
      });

      const observation = extractObservationFromLangchainResponse(updateResult);
      expect(observation.humanMessage).toContain(
        'Scheduled allowance transfer created successfully.',
      );
      expect(observation.raw.scheduleId).toBeDefined();
    }),
  );

  it('should fail gracefully when trying to transfer more than allowance', async () => {
    const input = `Use allowance from account ${executorAccountId.toString()} to send 300 ${tokenId.toString()} to account ${spenderAccountId.toString()}`;
    const result = await agentExecutor.invoke({ input });
    const observation = extractObservationFromLangchainResponse(result);

    expect(observation.humanMessage).toContain('Failed to transfer fungible token with allowance');
    expect(observation.humanMessage).toContain('AMOUNT_EXCEEDS_ALLOWANCE');
  });
});
