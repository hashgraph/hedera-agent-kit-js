import { afterAll, afterEach, beforeEach, beforeAll, describe, expect, it } from 'vitest';
import { Client, TokenId, TokenSupplyType } from '@hiero-ledger/sdk';
import { ReactAgent } from 'langchain';
import { createLangchainTestSetup, type LangchainTestSetup } from '@tests/utils';
import {
  getProfile,
  HederaOperationsWrapper,
  type TestAccount,
  waitForMirrorTx,
} from '@hashgraph/hedera-agent-kit-tests';
import { ResponseParserService } from '@hashgraph/hedera-agent-kit-langchain';

describe('Airdrop Fungible Token E2E Tests', () => {
  const profile = getProfile();
  let executor: TestAccount;
  let executorClient: Client;
  let executorWrapper: HederaOperationsWrapper;
  let tokenCreator: TestAccount;
  let tokenCreatorClient: Client;
  let tokenCreatorWrapper: HederaOperationsWrapper;
  let tokenIdFT: TokenId;
  let tokenIdFT2: TokenId;
  let testSetup: LangchainTestSetup;
  let agent: ReactAgent;
  let responseParsingService: ResponseParserService;

  const FT_PARAMS = {
    tokenName: 'AirdropToken',
    tokenSymbol: 'DROP',
    tokenMemo: 'FT-AIRDROP',
    initialSupply: 100000,
    decimals: 2,
    maxSupply: 500000,
    supplyType: TokenSupplyType.Finite,
  };

  beforeAll(async () => {
    // intentionally empty; accounts created per-test
  });

  afterAll(async () => {
    // intentionally empty; per-test cleanup happens in afterEach
  });

  beforeEach(async () => {
    // Executor account
    executor = await profile.accounts.acquire({ tier: 'STANDARD' });
    ({ client: executorClient, wrapper: executorWrapper } = profile.client.connectAs(executor));

    // Token creator account
    tokenCreator = await profile.accounts.acquire({ tier: 'STANDARD' });
    ({ client: tokenCreatorClient, wrapper: tokenCreatorWrapper } =
      profile.client.connectAs(tokenCreator));

    // Setup agent
    testSetup = await createLangchainTestSetup(undefined, undefined, executorClient);
    agent = testSetup.agent;
    responseParsingService = testSetup.responseParser;

    // Deploy fungible tokens
    tokenIdFT = await tokenCreatorWrapper
      .createFungibleToken({
        ...FT_PARAMS,
        supplyKey: tokenCreator.privateKey.publicKey,
        adminKey: tokenCreator.privateKey.publicKey,
        treasuryAccountId: tokenCreator.accountId.toString(),
      })
      .then(resp => resp.tokenId!);

    tokenIdFT2 = await tokenCreatorWrapper
      .createFungibleToken({
        ...FT_PARAMS,
        supplyKey: tokenCreator.privateKey.publicKey,
        adminKey: tokenCreator.privateKey.publicKey,
        treasuryAccountId: tokenCreator.accountId.toString(),
      })
      .then(resp => resp.tokenId!);
  });

  afterEach(async () => {
    await profile.accounts.release(executor);
    await profile.accounts.release(tokenCreator);
    testSetup?.cleanup();
    executorClient?.close();
    tokenCreatorClient?.close();
  });

  it(
    'should dissociate the executor account from the given token',
    async () => {
      const assocResp = await executorWrapper.associateToken({
        accountId: executor.accountId.toString(),
        tokenId: tokenIdFT.toString(),
      });
      await waitForMirrorTx(executorWrapper, assocResp.transactionId!);
      const tokenBalancesBefore = await executorWrapper.getAccountTokenBalances(
        executor.accountId.toString(),
      );
      expect(tokenBalancesBefore.find(t => t.tokenId === tokenIdFT.toString())).toBeTruthy();

      const queryResult = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: `Dissociate ${tokenIdFT.toString()} from my account`,
          },
        ],
      });

      const parsedResponse = responseParsingService.parseNewToolMessages(queryResult);

      expect(parsedResponse[0].parsedData.humanMessage).toContain('successfully dissociated');
      expect(parsedResponse[0].parsedData.raw.status).toBe('SUCCESS');

      await waitForMirrorTx(executorWrapper, parsedResponse[0].parsedData.raw.transactionId);

      const tokenBalancesAfter = await executorWrapper.getAccountTokenBalances(
        executor.accountId.toString(),
      );
      expect(tokenBalancesAfter.find(t => t.tokenId === tokenIdFT.toString())).toBeFalsy();
    },
  );

  it(
    'should dissociate 2 tokens at once',
    async () => {
      await executorWrapper.associateToken({
        accountId: executor.accountId.toString(),
        tokenId: tokenIdFT.toString(),
      });
      const assoc2Resp = await executorWrapper.associateToken({
        accountId: executor.accountId.toString(),
        tokenId: tokenIdFT2.toString(),
      });

      await waitForMirrorTx(executorWrapper, assoc2Resp.transactionId!);

      const tokenBalancesBefore = await executorWrapper.getAccountTokenBalances(
        executor.accountId.toString(),
      );
      expect(tokenBalancesBefore.find(t => t.tokenId === tokenIdFT.toString())).toBeTruthy();
      expect(tokenBalancesBefore.find(t => t.tokenId === tokenIdFT2.toString())).toBeTruthy();

      const queryResult = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: `Dissociate tokens ${tokenIdFT.toString()} and ${tokenIdFT2.toString()} from my account`,
          },
        ],
      });

      const parsedResponse = responseParsingService.parseNewToolMessages(queryResult);

      expect(parsedResponse[0].parsedData.humanMessage).toContain('successfully dissociated');
      expect(parsedResponse[0].parsedData.raw.status).toBe('SUCCESS');

      await waitForMirrorTx(executorWrapper, parsedResponse[0].parsedData.raw.transactionId);

      const tokenBalancesAfter = await executorWrapper.getAccountTokenBalances(
        executor.accountId.toString(),
      );
      expect(tokenBalancesAfter.find(t => t.tokenId === tokenIdFT.toString())).toBeFalsy();
      expect(tokenBalancesAfter.find(t => t.tokenId === tokenIdFT2.toString())).toBeFalsy();
    },
  );

  it(
    'should fail dissociating not associated token',
    async () => {
      // check if the account is not associate with the token
      const tokenBalancesBefore = await executorWrapper.getAccountTokenBalances(
        executor.accountId.toString(),
      );

      expect(tokenBalancesBefore.find(t => t.tokenId === tokenIdFT.toString())).toBeFalsy();

      const queryResult = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: `Dissociate ${tokenIdFT.toString()} from my account`,
          },
        ],
      });

      const parsedResponse = responseParsingService.parseNewToolMessages(queryResult);

      expect(parsedResponse[0].parsedData.humanMessage).toContain('Failed to execute Dissociate Token');
      expect(parsedResponse[0].parsedData.raw.status).not.toBe('SUCCESS');
    },
  );

  it(
    'should fail dissociating not existing token',
    async () => {
      const queryResult = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: `Dissociate token 0.0.22223333444 from my account`,
          },
        ],
      });

      const parsedResponse = responseParsingService.parseNewToolMessages(queryResult);

      expect(parsedResponse[0].parsedData.humanMessage).toContain('Failed to execute Dissociate Token');
      expect(parsedResponse[0].parsedData.raw.status).not.toBe('SUCCESS');
    },
  );
});
