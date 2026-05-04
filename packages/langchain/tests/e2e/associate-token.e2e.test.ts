import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client, TokenSupplyType, PublicKey } from '@hiero-ledger/sdk';
import { ReactAgent } from 'langchain';
import { createLangchainTestSetup, type LangchainTestSetup } from '@tests/utils';
import {
  getProfile,
  HederaOperationsWrapper,
  type TestAccount,
  waitForMirrorTx,
  itWithRetry,
} from '@hashgraph/hedera-agent-kit-tests';
import { ResponseParserService } from '@hashgraph/hedera-agent-kit-langchain';

describe('Associate Token E2E Tests', () => {
  const profile = getProfile();
  let executor: TestAccount;
  let executorClient: Client;
  let executorWrapper: HederaOperationsWrapper;
  let tokenExecutor: TestAccount;
  let tokenExecutorClient: Client;
  let tokenExecutorWrapper: HederaOperationsWrapper;
  let testSetup: LangchainTestSetup;
  let agent: ReactAgent;
  let responseParsingService: ResponseParserService;

  const FT_PARAMS = {
    tokenName: 'AssocToken',
    tokenSymbol: 'ASSOC',
    tokenMemo: 'FT',
    initialSupply: 0,
    decimals: 0,
    maxSupply: 1000,
    supplyType: TokenSupplyType.Finite,
  };

  beforeAll(async () => {
    executor = await profile.accounts.acquire({ tier: 'STANDARD' });
    ({ client: executorClient, wrapper: executorWrapper } = profile.client.connectAs(executor));

    tokenExecutor = await profile.accounts.acquire({ tier: 'STANDARD' });
    ({ client: tokenExecutorClient, wrapper: tokenExecutorWrapper } =
      profile.client.connectAs(tokenExecutor));

    testSetup = await createLangchainTestSetup(undefined, undefined, executorClient);
    agent = testSetup.agent;
    responseParsingService = testSetup.responseParser;
  });

  afterAll(async () => {
    await profile.accounts.release(tokenExecutor);
    await profile.accounts.release(executor);
    testSetup?.cleanup();
    executorClient?.close();
    tokenExecutorClient?.close();
  });

  it(
    'should associate token successfully via agent',
    itWithRetry(async () => {
      const createTokenResp = await tokenExecutorWrapper.createFungibleToken({
        ...FT_PARAMS,
        supplyKey: tokenExecutor.privateKey.publicKey as PublicKey,
        adminKey: tokenExecutor.privateKey.publicKey as PublicKey,
        treasuryAccountId: tokenExecutor.accountId.toString(),
        autoRenewAccountId: tokenExecutor.accountId.toString(),
      });
      const tokenIdFT1 = createTokenResp.tokenId!;

      await waitForMirrorTx(tokenExecutorWrapper, createTokenResp.transactionId!);
      const queryResult = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: `Associate token ${tokenIdFT1.toString()} to my account`,
          },
        ],
      });

      const parsedResponse = responseParsingService.parseNewToolMessages(queryResult);
      await waitForMirrorTx(executorWrapper, parsedResponse[0].parsedData.raw.transactionId);

      const balances = await executorWrapper.getAccountBalances(executor.accountId.toString());
      const associated = balances.tokens.some(t => t.token_id === tokenIdFT1.toString()); // presence implies associated

      expect(parsedResponse[0].parsedData.humanMessage).toContain('Tokens successfully associated');
      expect(parsedResponse[0].parsedData.raw.status).toBe('SUCCESS');
      expect(associated).toBe(true);
    }),
  );

  it(
    'should associate two tokens successfully via agent',
    itWithRetry(async () => {
      const createToken1Resp = await tokenExecutorWrapper.createFungibleToken({
        ...FT_PARAMS,
        supplyKey: tokenExecutor.privateKey.publicKey as PublicKey,
        adminKey: tokenExecutor.privateKey.publicKey as PublicKey,
        treasuryAccountId: tokenExecutor.accountId.toString(),
        autoRenewAccountId: tokenExecutor.accountId.toString(),
      });
      const tokenIdFT1 = createToken1Resp.tokenId!;
      // Create an extra token
      const createToken2Resp = await tokenExecutorWrapper.createFungibleToken({
        tokenName: 'AssocToken2',
        tokenSymbol: 'ASSOC2',
        tokenMemo: 'FT2',
        initialSupply: 0,
        decimals: 0,
        maxSupply: 1000,
        supplyType: TokenSupplyType.Finite,
        supplyKey: tokenExecutor.privateKey.publicKey as PublicKey,
        adminKey: tokenExecutor.privateKey.publicKey as PublicKey,
        treasuryAccountId: tokenExecutor.accountId.toString(),
        autoRenewAccountId: tokenExecutor.accountId.toString(),
      });
      const tokenIdFT2 = createToken2Resp.tokenId!;

      await waitForMirrorTx(tokenExecutorWrapper, createToken2Resp.transactionId!);

      const queryResult = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: `Associate tokens ${tokenIdFT1.toString()} and ${tokenIdFT2.toString()} to my account`,
          },
        ],
      });

      const parsedResponse = responseParsingService.parseNewToolMessages(queryResult);
      await waitForMirrorTx(executorWrapper, parsedResponse[0].parsedData.raw.transactionId);

      const balances = await executorWrapper.getAccountBalances(executor.accountId.toString());
      const associatedFirst = balances.tokens.some(t => t.token_id === tokenIdFT1.toString());
      const associatedSecond = balances.tokens.some(t => t.token_id === tokenIdFT2.toString());

      expect(parsedResponse[0].parsedData.humanMessage).toContain('Tokens successfully associated');
      expect(parsedResponse[0].parsedData.raw.status).toBe('SUCCESS');
      expect(associatedFirst).toBe(true);
      expect(associatedSecond).toBe(true);
    }),
  );
});
