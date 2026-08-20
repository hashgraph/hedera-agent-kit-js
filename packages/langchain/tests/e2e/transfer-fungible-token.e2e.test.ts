import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { Client, PublicKey, TokenId, TokenSupplyType } from '@hiero-ledger/sdk';
import { createLangchainTestSetup, LangchainTestSetup } from '@tests/utils';
import {
  getProfile,
  HederaOperationsWrapper,
  type TestAccount,
  waitForMirrorTx,
} from '@hashgraph/hedera-agent-kit-tests';
import { ResponseParserService } from '@hashgraph/hedera-agent-kit-langchain';
import { ReactAgent } from 'langchain';

describe('Transfer Fungible Token E2E Tests', () => {
  const profile = getProfile();
  let testSetup: LangchainTestSetup;
  let agent: ReactAgent;
  let responseParsingService: ResponseParserService;

  let executor: TestAccount;
  let executorClient: Client;
  let executorWrapper: HederaOperationsWrapper;

  let receiver: TestAccount;
  let receiverWrapper: HederaOperationsWrapper;

  let tokenId: TokenId;

  const FT_PARAMS = {
    tokenName: 'E2ETransferToken',
    tokenSymbol: 'E2ETT',
    tokenMemo: 'Token for E2E direct transfer tests',
    initialSupply: 1000,
    decimals: 0,
    maxSupply: 10000,
    supplyType: TokenSupplyType.Finite,
  };

  beforeAll(async () => {
    executor = await profile.accounts.acquire({ tier: 'STANDARD' });
    ({ client: executorClient, wrapper: executorWrapper } = profile.client.connectAs(executor));

    tokenId = await executorWrapper
      .createFungibleToken({
        ...FT_PARAMS,
        treasuryAccountId: executor.accountId.toString(),
        supplyKey: executor.privateKey.publicKey as PublicKey,
        adminKey: executor.privateKey.publicKey as PublicKey,
        autoRenewAccountId: executor.accountId.toString(),
      })
      .then(r => r.tokenId!);

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
    receiver = await profile.accounts.acquire({ tier: 'MINIMAL' });
    ({ wrapper: receiverWrapper } = profile.client.connectAs(receiver));

    await receiverWrapper.associateToken({
      accountId: receiver.accountId.toString(),
      tokenId: tokenId.toString(),
    });
  });

  afterEach(async () => {
    await profile.accounts.release(receiver);
  });

  it('should transfer fungible tokens to a single recipient', async () => {
    const input = `Transfer 50 of token ${tokenId.toString()} to account ${receiver.accountId.toString()}`;
    const result = await agent.invoke({
      messages: [{ role: 'user', content: input }],
    });
    const parsedResponse = responseParsingService.parseNewToolMessages(result);

    expect(parsedResponse[0].parsedData.humanMessage).toContain(
      'Fungible tokens successfully transferred',
    );
    expect(parsedResponse[0].parsedData.raw.status).toBe('SUCCESS');

    await waitForMirrorTx(executorWrapper, parsedResponse[0].parsedData.raw.transactionId);

    const balance = await receiverWrapper.getAccountTokenBalanceFromMirrornode(
      receiver.accountId.toString(),
      tokenId.toString(),
    );
    expect(balance.balance).toBe(50);
  });

  it('should transfer fungible tokens to multiple recipients', async () => {
    const receiver2 = await profile.accounts.acquire({ tier: 'MINIMAL' });
    const { wrapper: receiver2Wrapper } = profile.client.connectAs(receiver2);

    await receiver2Wrapper.associateToken({
      accountId: receiver2.accountId.toString(),
      tokenId: tokenId.toString(),
    });

    const input = `Send 30 of token ${tokenId.toString()} to ${receiver.accountId.toString()} and 70 to ${receiver2.accountId.toString()}`;
    const result = await agent.invoke({
      messages: [{ role: 'user', content: input }],
    });
    const parsedResponse = responseParsingService.parseNewToolMessages(result);

    expect(parsedResponse[0].parsedData.humanMessage).toContain(
      'Fungible tokens successfully transferred',
    );
    expect(parsedResponse[0].parsedData.raw.status).toBe('SUCCESS');

    await waitForMirrorTx(executorWrapper, parsedResponse[0].parsedData.raw.transactionId);

    const [bal1, bal2] = await Promise.all([
      receiverWrapper.getAccountTokenBalanceFromMirrornode(
        receiver.accountId.toString(),
        tokenId.toString(),
      ),
      receiver2Wrapper.getAccountTokenBalanceFromMirrornode(
        receiver2.accountId.toString(),
        tokenId.toString(),
      ),
    ]);

    expect(bal1.balance).toBe(30);
    expect(bal2.balance).toBe(70);

    await profile.accounts.release(receiver2);
  });

  it('should schedule a fungible token transfer', async () => {
    const input = `Transfer 10 of token ${tokenId.toString()} to ${receiver.accountId.toString()}. Schedule the transaction instead of executing it immediately.`;
    const result = await agent.invoke({
      messages: [{ role: 'user', content: input }],
    });
    const parsedResponse = responseParsingService.parseNewToolMessages(result);

    expect(parsedResponse[0].parsedData.humanMessage).toContain(
      'Scheduled fungible token transfer created successfully',
    );
    expect(parsedResponse[0].parsedData.raw.status).toBe('SUCCESS');
    expect(parsedResponse[0].parsedData.raw.scheduleId).toBeDefined();
  });

  it('should fail gracefully when transferring more tokens than available', async () => {
    const input = `Transfer 999999 of token ${tokenId.toString()} to ${receiver.accountId.toString()}`;
    const result = await agent.invoke({
      messages: [{ role: 'user', content: input }],
    });
    const parsedResponse = responseParsingService.parseNewToolMessages(result);

    expect(parsedResponse[0].parsedData.humanMessage).toContain(
      'Failed to execute Transfer Fungible Token',
    );
    expect(parsedResponse[0].parsedData.raw.status).toBe('ERROR');
  });
});
