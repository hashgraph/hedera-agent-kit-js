import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Client, TokenId, TokenSupplyType, PublicKey } from '@hiero-ledger/sdk';
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

describe('Mint Fungible Token E2E Tests', () => {
  const profile = getProfile();
  let executor: TestAccount;
  let executorClient: Client;
  let executorWrapper: HederaOperationsWrapper;
  let tokenIdFT: TokenId;
  let testSetup: LangchainTestSetup;
  let agent: ReactAgent;
  let responseParsingService: ResponseParserService;

  const FT_PARAMS = {
    tokenName: 'MintableToken',
    tokenSymbol: 'MINT',
    tokenMemo: 'FT',
    initialSupply: 100,
    decimals: 2,
    maxSupply: 1000,
    supplyType: TokenSupplyType.Finite,
  };

  beforeAll(async () => {
    executor = await profile.accounts.acquire({ tier: 'STANDARD' });
    ({ client: executorClient, wrapper: executorWrapper } = profile.client.connectAs(executor));

    testSetup = await createLangchainTestSetup(undefined, undefined, executorClient);
    agent = testSetup.agent;
    responseParsingService = testSetup.responseParser;

    const createTokenResp = await executorWrapper.createFungibleToken({
      ...FT_PARAMS,
      supplyKey: executor.privateKey.publicKey as PublicKey,
      adminKey: executor.privateKey.publicKey as PublicKey,
      treasuryAccountId: executor.accountId.toString(),
      autoRenewAccountId: executor.accountId.toString(),
    });
    tokenIdFT = createTokenResp.tokenId!;

    await waitForMirrorTx(executorWrapper, createTokenResp.transactionId!);
  });

  afterAll(async () => {
    await profile.accounts.release(executor);
    testSetup?.cleanup();
    executorClient?.close();
  });

  beforeEach(async () => {
    await new Promise(resolve => setTimeout(resolve, 30000));
  });

  it(
    'should mint additional supply successfully',
    itWithRetry(async () => {
      const supplyBefore = await executorWrapper
        .getTokenInfo(tokenIdFT.toString())
        .then(info => info.totalSupply.toInt());

      const queryResult = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: `Mint 5 of token ${tokenIdFT.toString()}`,
          },
        ],
      });

      const parsedResponse = responseParsingService.parseNewToolMessages(queryResult);
      await waitForMirrorTx(executorWrapper, parsedResponse[0].parsedData.raw.transactionId);

      const supplyAfter = await executorWrapper
        .getTokenInfo(tokenIdFT.toString())
        .then(info => info.totalSupply.toInt());

      expect(parsedResponse[0].parsedData.humanMessage).toContain('Tokens successfully minted');
      expect(parsedResponse[0].parsedData.raw.status).toBe('SUCCESS');
      expect(supplyAfter).toBe(supplyBefore + 500); // 5 * 10^decimals
    }),
  );

  it(
    'should schedule minting additional supply successfully',
    itWithRetry(async () => {
      const updateResult = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: `Mint 5 of token ${tokenIdFT.toString()}. Schedule the transaction instead of executing it immediately.`,
          },
        ],
      });

      const parsedResponse = responseParsingService.parseNewToolMessages(updateResult);
      expect(parsedResponse[0].parsedData.humanMessage).toContain(
        'Scheduled mint transaction created successfully.',
      );
      expect(parsedResponse[0].parsedData.raw.scheduleId).toBeDefined();
    }),
  );

  it(
    'should fail gracefully when minting more than max supply',
    itWithRetry(async () => {
      const queryResult = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: `Mint 5000 of token ${tokenIdFT.toString()}`,
          },
        ],
      });

      const parsedResponse = responseParsingService.parseNewToolMessages(queryResult);

      expect(parsedResponse[0].parsedData.raw).toBeDefined();
      expect(parsedResponse[0].parsedData.raw.error).toContain('TOKEN_MAX_SUPPLY_REACHED');
    }),
  );

  it(
    'should fail gracefully for a non-existent token',
    itWithRetry(async () => {
      const fakeTokenId = '0.0.999999999';

      const queryResult = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: `Mint 10 of token ${fakeTokenId}`,
          },
        ],
      });

      const parsedResponse = responseParsingService.parseNewToolMessages(queryResult);

      expect(parsedResponse[0].parsedData.humanMessage).toContain('Not Found');
      expect(parsedResponse[0].parsedData.raw.error).toContain('Not Found');
      expect(parsedResponse[0].parsedData.humanMessage).toContain(
        `Failed to get token info for a token ${fakeTokenId}`,
      );
      expect(parsedResponse[0].parsedData.raw.error).toContain(
        `Failed to get token info for a token ${fakeTokenId}`,
      );
    }),
  );
});
