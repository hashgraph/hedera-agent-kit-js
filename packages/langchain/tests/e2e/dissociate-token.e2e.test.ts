import { afterAll, afterEach, beforeEach, beforeAll, describe, expect, it } from 'vitest';
import { AccountId, Client, PrivateKey, TokenId, TokenSupplyType } from '@hashgraph/sdk';
import { ReactAgent } from 'langchain';
import {
  getCustomClient,
  getOperatorClientForTests,
} from '@hashgraph/hedera-agent-kit-tests/shared/setup/client-setup';
import { createLangchainTestSetup, type LangchainTestSetup } from '@tests/utils';
import HederaOperationsWrapper from '@hashgraph/hedera-agent-kit-tests/shared/hedera-operations/HederaOperationsWrapper';
import { ResponseParserService } from '@hashgraph/hedera-agent-kit-langchain';
import { returnHbarsAndDeleteAccount } from '@hashgraph/hedera-agent-kit-tests/shared/teardown/account-teardown';
import { itWithRetry } from '@hashgraph/hedera-agent-kit-tests/shared/retry-util';
import { UsdToHbarService } from '@hashgraph/hedera-agent-kit-tests/shared/usd-to-hbar-service';
import { BALANCE_TIERS } from '@tests/utils';
import { wait } from '@hashgraph/hedera-agent-kit-tests/shared/general-util';
import { MIRROR_NODE_WAITING_TIME } from '@hashgraph/hedera-agent-kit-tests/shared/test-constants';

describe('Airdrop Fungible Token E2E Tests', () => {
  let operatorClient: Client;
  let executorClient: Client;
  let tokenCreatorClient: Client;
  let executorAccountId: AccountId;
  let tokenCreatorAccountId: AccountId;
  let executorWrapper: HederaOperationsWrapper;
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
    operatorClient = getOperatorClientForTests();
  });

  afterAll(async () => {
    if (operatorClient) {
      operatorClient.close();
    }
  });

  beforeEach(async () => {
    const operatorWrapper = new HederaOperationsWrapper(operatorClient);

    // Executor account
    const executorKey = PrivateKey.generateED25519();
    executorAccountId = await operatorWrapper
      .createAccount({
        key: executorKey.publicKey,
        initialBalance: 50,
        maxAutomaticTokenAssociations: -1,
      })
      .then(resp => resp.accountId!);

    executorClient = getCustomClient(executorAccountId, executorKey);
    executorWrapper = new HederaOperationsWrapper(executorClient);

    // Token creator account
    const tokenCreatorKey = PrivateKey.generateED25519();
    tokenCreatorAccountId = await operatorWrapper
      .createAccount({
        key: tokenCreatorKey.publicKey,
        initialBalance: UsdToHbarService.usdToHbar(BALANCE_TIERS.STANDARD),
      })
      .then(resp => resp.accountId!);

    tokenCreatorClient = getCustomClient(tokenCreatorAccountId, tokenCreatorKey);
    tokenCreatorWrapper = new HederaOperationsWrapper(tokenCreatorClient);

    // Setup agent
    testSetup = await createLangchainTestSetup(undefined, undefined, executorClient);
    agent = testSetup.agent;
    responseParsingService = testSetup.responseParser;

    // Deploy fungible tokens
    tokenIdFT = await tokenCreatorWrapper
      .createFungibleToken({
        ...FT_PARAMS,
        supplyKey: tokenCreatorKey.publicKey,
        adminKey: tokenCreatorKey.publicKey,
        treasuryAccountId: tokenCreatorAccountId.toString(),
      })
      .then(resp => resp.tokenId!);

    tokenIdFT2 = await tokenCreatorWrapper
      .createFungibleToken({
        ...FT_PARAMS,
        supplyKey: tokenCreatorKey.publicKey,
        adminKey: tokenCreatorKey.publicKey,
        treasuryAccountId: tokenCreatorAccountId.toString(),
      })
      .then(resp => resp.tokenId!);
  });

  afterEach(async () => {
    // Delete executor and token creator accounts
    if (executorClient && operatorClient) {
      await returnHbarsAndDeleteAccount(
        executorWrapper,
        executorAccountId,
        operatorClient.operatorAccountId!,
      );
      await returnHbarsAndDeleteAccount(
        tokenCreatorWrapper,
        tokenCreatorAccountId,
        operatorClient.operatorAccountId!,
      );
      executorClient.close();
      tokenCreatorClient.close();
    }
  });

  it(
    'should dissociate the executor account from the given token',
    itWithRetry(async () => {
      await executorWrapper.associateToken({
        accountId: executorAccountId.toString(),
        tokenId: tokenIdFT.toString(),
      });
      await wait(MIRROR_NODE_WAITING_TIME);
      const tokenBalancesBefore = await executorWrapper.getAccountTokenBalances(
        executorAccountId.toString(),
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

      await wait(MIRROR_NODE_WAITING_TIME);

      const tokenBalancesAfter = await executorWrapper.getAccountTokenBalances(
        executorAccountId.toString(),
      );
      expect(tokenBalancesAfter.find(t => t.tokenId === tokenIdFT.toString())).toBeFalsy();
    }),
  );

  it(
    'should dissociate 2 tokens at once',
    itWithRetry(async () => {
      await executorWrapper.associateToken({
        accountId: executorAccountId.toString(),
        tokenId: tokenIdFT.toString(),
      });
      await executorWrapper.associateToken({
        accountId: executorAccountId.toString(),
        tokenId: tokenIdFT2.toString(),
      });

      await wait(MIRROR_NODE_WAITING_TIME);

      const tokenBalancesBefore = await executorWrapper.getAccountTokenBalances(
        executorAccountId.toString(),
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

      await wait(MIRROR_NODE_WAITING_TIME);

      const tokenBalancesAfter = await executorWrapper.getAccountTokenBalances(
        executorAccountId.toString(),
      );
      expect(tokenBalancesAfter.find(t => t.tokenId === tokenIdFT.toString())).toBeFalsy();
      expect(tokenBalancesAfter.find(t => t.tokenId === tokenIdFT2.toString())).toBeFalsy();
    }),
  );

  it(
    'should fail dissociating not associated token',
    itWithRetry(async () => {
      // check if the account is not associate with the token
      await wait(MIRROR_NODE_WAITING_TIME);
      const tokenBalancesBefore = await executorWrapper.getAccountTokenBalances(
        executorAccountId.toString(),
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

      expect(parsedResponse[0].parsedData.humanMessage).toContain('Failed to dissociate');
      expect(parsedResponse[0].parsedData.raw.status).not.toBe('SUCCESS');
    }),
  );

  it(
    'should fail dissociating not existing token',
    itWithRetry(async () => {
      const queryResult = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: `Dissociate token 0.0.22223333444 from my account`,
          },
        ],
      });

      const parsedResponse = responseParsingService.parseNewToolMessages(queryResult);

      expect(parsedResponse[0].parsedData.humanMessage).toContain('Failed to dissociate');
      expect(parsedResponse[0].parsedData.raw.status).not.toBe('SUCCESS');
    }),
  );
});
