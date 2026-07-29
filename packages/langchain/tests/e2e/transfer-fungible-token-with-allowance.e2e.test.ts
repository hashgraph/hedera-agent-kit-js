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
  waitForMirrorTx,
} from '@hashgraph/hedera-agent-kit-tests';
import { ResponseParserService } from '@hashgraph/hedera-agent-kit-langchain';
import { ReactAgent } from 'langchain';

describe('Transfer Fungible Token With Allowance E2E Tests', () => {
  const profile = getProfile();
  let testSetup: LangchainTestSetup;
  let agent: ReactAgent;
  let responseParsingService: ResponseParserService;

  let executor: TestAccount;
  let executorClient: Client;
  let executorWrapper: HederaOperationsWrapper;

  let spender: TestAccount;
  let spenderClient: Client;
  let spenderWrapper: HederaOperationsWrapper;

  let receiver: TestAccount;
  let receiverClient: Client;
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
      .then(r => r.tokenId!);
  });

  afterAll(async () => {
    await profile.accounts.release(executor);
    executorClient?.close();
  });

  beforeEach(async () => {
    // Spender account
    spender = await profile.accounts.acquire({ tier: 'MINIMAL' });
    ({ client: spenderClient, wrapper: spenderWrapper } = profile.client.connectAs(spender));

    // Receiver account
    receiver = await profile.accounts.acquire({ tier: 'MINIMAL' });
    ({ client: receiverClient, wrapper: receiverWrapper } = profile.client.connectAs(receiver));

    // Associate token to spender and receiver (each must sign their own associate)
    await spenderWrapper.associateToken({
      accountId: spender.accountId.toString(),
      tokenId: tokenId.toString(),
    });
    await receiverWrapper.associateToken({
      accountId: receiver.accountId.toString(),
      tokenId: tokenId.toString(),
    });

    // Approve allowance for spender
    await executorWrapper.approveTokenAllowance({
      tokenApprovals: [
        new TokenAllowance({
          tokenId,
          ownerAccountId: executor.accountId,
          spenderAccountId: spender.accountId,
          amount: Long.fromNumber(200),
        }),
      ],
    });

    // Setup LangChain agent with spender client
    testSetup = await createLangchainTestSetup(undefined, undefined, spenderClient);
    agent = testSetup.agent;
    responseParsingService = testSetup.responseParser;
  });

  afterEach(async () => {
    await profile.accounts.release(spender);
    await profile.accounts.release(receiver);
    testSetup?.cleanup();
    spenderClient?.close();
    receiverClient?.close();
  });

  it('should allow spender to transfer tokens to themselves using allowance', async () => {
    console.log(
      `Account ids: ${executor.accountId.toString()}, ${spender.accountId.toString()}, ${receiver.accountId.toString()}`,
    );
    const input = `Use allowance from account ${executor.accountId.toString()} to send 50 ${tokenId.toString()} to account ${spender.accountId.toString()}`;
    const result = await agent.invoke({
      messages: [
        {
          role: 'user',
          content: input,
        },
      ],
    });
    const parsedResponse = responseParsingService.parseNewToolMessages(result);

    expect(parsedResponse[0].parsedData.humanMessage).toContain(
      'Fungible tokens successfully transferred with allowance',
    );
    expect(parsedResponse[0].parsedData.raw.status).toBe('SUCCESS');

    await waitForMirrorTx(executorWrapper, parsedResponse[0].parsedData.raw.transactionId);

    // FIXME: the xyzWrapper.getAccountTokenBalance() calls are failing with INVALID_ACCOUNT_ID and tx id 0.0.0@...
    // using mirrornode instead is a workaround
    const spenderBalance = await spenderWrapper.getAccountTokenBalanceFromMirrornode(
      spender.accountId.toString(),
      tokenId.toString(),
    );

    expect(spenderBalance.balance).toBe(50);
  });

  it('should allow spender to transfer tokens to both themselves and receiver in one allowance call', async () => {
    const input = `Use allowance from account ${executor.accountId.toString()} to send 30 ${tokenId.toString()} to account ${spender.accountId.toString()} and 70 ${tokenId.toString()} to account ${receiver.accountId.toString()}`;
    const result = await agent.invoke({
      messages: [
        {
          role: 'user',
          content: input,
        },
      ],
    });
    const parsedResponse = responseParsingService.parseNewToolMessages(result);

    expect(parsedResponse[0].parsedData.humanMessage).toContain(
      'Fungible tokens successfully transferred with allowance',
    );
    expect(parsedResponse[0].parsedData.raw.status).toBe('SUCCESS');

    await waitForMirrorTx(executorWrapper, parsedResponse[0].parsedData.raw.transactionId);

    // FIXME: the xyzWrapper.getAccountTokenBalance() calls are failing with INVALID_ACCOUNT_ID and tx id 0.0.0@...
    // using mirrornode instead is a workaround
    const spenderBalance = await spenderWrapper.getAccountTokenBalanceFromMirrornode(
      spender.accountId.toString(),
      tokenId.toString(),
    );
    const receiverBalance = await receiverWrapper.getAccountTokenBalanceFromMirrornode(
      receiver.accountId.toString(),
      tokenId.toString(),
    );

    expect(spenderBalance.balance).toBe(30);
    expect(receiverBalance.balance).toBe(70);
  });

  it(
    'should schedule allowing spender to transfer tokens to themselves using allowance',
    async () => {
      const updateResult = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: `Use allowance from account ${executor.accountId.toString()} to send 50 ${tokenId.toString()} to account ${spender.accountId.toString()}. Schedule the transaction instead of executing it immediately.`,
          },
        ],
      });

      const parsedResponse = responseParsingService.parseNewToolMessages(updateResult);
      expect(parsedResponse[0].parsedData.humanMessage).toContain(
        'Scheduled allowance transfer created successfully.',
      );
      expect(parsedResponse[0].parsedData.raw.scheduleId).toBeDefined();
    },
  );

  it('should fail gracefully when trying to transfer more than allowance', async () => {
    const input = `Use allowance from account ${executor.accountId.toString()} to send 300 ${tokenId.toString()} to account ${spender.accountId.toString()}`;
    const result = await agent.invoke({
      messages: [
        {
          role: 'user',
          content: input,
        },
      ],
    });
    const parsedResponse = responseParsingService.parseNewToolMessages(result);

    expect(parsedResponse[0].parsedData.humanMessage).toContain(
      'Failed to execute Transfer Fungible Token with Allowance',
    );
    expect(parsedResponse[0].parsedData.humanMessage).toContain('AMOUNT_EXCEEDS_ALLOWANCE');
  });

  it('should surface TOKEN_NOT_ASSOCIATED_TO_ACCOUNT with an actionable hint when recipient has not associated the token', async () => {
    // Acquire a receiver with maxAutoAssociations=0 so HTS auto-association is disabled.
    const unassociatedReceiver = await profile.accounts.acquire({
      tier: 'MINIMAL',
      preset: 'pending-airdrop-recipient',
    });

    try {
      const input =
        `Use the allowance from account ${executor.accountId.toString()} to send 10 ` +
        `${tokenId.toString()} tokens to account ${unassociatedReceiver.accountId.toString()}`;

      const result = await agent.invoke({
        messages: [{ role: 'user', content: input }],
      });

      const parsedResponse = responseParsingService.parseNewToolMessages(result);

      // The first transfer attempt must fail with the association error and carry the hint.
      const transferResult = parsedResponse.find(
        r => r.toolName === 'transfer_fungible_token_with_allowance_tool',
      );
      expect(transferResult).toBeDefined();
      expect(transferResult!.parsedData.raw.status).toBe('ERROR');
      expect(transferResult!.parsedData.raw.errorCode).toBe('TOKEN_NOT_ASSOCIATED_TO_ACCOUNT');
      expect(transferResult!.parsedData.humanMessage).toContain('associate_token_tool');
    } finally {
      await profile.accounts.release(unassociatedReceiver);
    }
  });
});
