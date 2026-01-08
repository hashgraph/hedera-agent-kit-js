import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AccountId, Client, PrivateKey, PublicKey, TokenId, TokenSupplyType } from '@hashgraph/sdk';

import {
  createLangchainTestSetup,
  getCustomClient,
  getOperatorClientForTests,
  HederaOperationsWrapper,
  type LangchainTestSetup,
} from '../utils';
import { wait } from '../utils/general-util';
import { returnHbarsAndDeleteAccount } from '../utils/teardown/account-teardown';
import { MIRROR_NODE_WAITING_TIME } from '../utils/test-constants';
import { itWithRetry } from '../utils/retry-util';
import { ReactAgent } from 'langchain';
import { ResponseParserService } from '@/langchain';
import { UsdToHbarService } from '../utils/usd-to-hbar-service';
import { BALANCE_TIERS } from '../utils/setup/langchain-test-config';

describe('Airdrop Fungible Token E2E Tests', () => {
  let operatorClient: Client;
  let executorClient: Client;
  let executorAccountId: AccountId;
  let executorWrapper: HederaOperationsWrapper;
  let tokenIdFT: TokenId;
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
    const operatorWrapper = new HederaOperationsWrapper(operatorClient);

    // Executor account
    const executorKey = PrivateKey.generateED25519();
    executorAccountId = await operatorWrapper
      .createAccount({
        key: executorKey.publicKey,
        initialBalance: UsdToHbarService.usdToHbar(BALANCE_TIERS.STANDARD),
        accountMemo: 'executor account for Airdrop Fungible Token E2E Tests',
      })
      .then(resp => resp.accountId!);

    executorClient = getCustomClient(executorAccountId, executorKey);
    executorWrapper = new HederaOperationsWrapper(executorClient);

    // Setup agent
    testSetup = await createLangchainTestSetup(undefined, undefined, executorClient);
    agent = testSetup.agent;
    responseParsingService = testSetup.responseParser;

    // Deploy fungible token
    tokenIdFT = await executorWrapper
      .createFungibleToken({
        ...FT_PARAMS,
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

  const createRecipientAccount = async (maxAutomaticTokenAssociations: number) => {
    const recipientKey = PrivateKey.generateED25519();

    return await executorWrapper
      .createAccount({
        key: recipientKey.publicKey,
        initialBalance: 0,
        maxAutomaticTokenAssociations,
        accountMemo: 'recipient account for Airdrop Fungible Token E2E Tests',
      })
      .then(resp => resp.accountId!);
  };

  it(
    'should airdrop tokens to a single recipient successfully',
    itWithRetry(async () => {
      const recipientId = await createRecipientAccount(0); // no auto-association

      const queryResult = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: `Airdrop 50 of token ${tokenIdFT.toString()} from ${executorAccountId.toString()} to ${recipientId.toString()}`,
          },
        ],
      });

      const parsedResponse = responseParsingService.parseNewToolMessages(queryResult);
      await wait(MIRROR_NODE_WAITING_TIME);

      expect(parsedResponse[0].parsedData.humanMessage).toContain('Token successfully airdropped');
      expect(parsedResponse[0].parsedData.raw.status).toBe('SUCCESS');

      const pending = await executorWrapper.getPendingAirdrops(recipientId.toString());
      expect(pending.airdrops.length).toBeGreaterThan(0);
    }),
  );

  it(
    'should airdrop tokens to multiple recipients in one transaction',
    itWithRetry(async () => {
      const recipient1 = await createRecipientAccount(0);
      const recipient2 = await createRecipientAccount(0);

      const queryResult = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: `Airdrop 10 of token ${tokenIdFT.toString()} from ${executorAccountId.toString()} to ${recipient1.toString()} and 20 to ${recipient2.toString()}`,
          },
        ],
      });

      const parsedResponse = responseParsingService.parseNewToolMessages(queryResult);
      await wait(MIRROR_NODE_WAITING_TIME);

      expect(parsedResponse[0].parsedData.raw.status).toBe('SUCCESS');

      const pending1 = await executorWrapper.getPendingAirdrops(recipient1.toString());
      const pending2 = await executorWrapper.getPendingAirdrops(recipient2.toString());

      expect(pending1.airdrops.length).toBeGreaterThan(0);
      expect(pending2.airdrops.length).toBeGreaterThan(0);
    }),
  );

  it(
    'should fail gracefully for non-existent token',
    itWithRetry(async () => {
      const recipientId = await createRecipientAccount(0);
      const fakeTokenId = '0.0.999999999';

      const queryResult = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: `Airdrop 5 of token ${fakeTokenId} from ${executorAccountId.toString()} to ${recipientId.toString()}`,
          },
        ],
      });

      const parsedResponse = responseParsingService.parseNewToolMessages(queryResult);

      expect(parsedResponse[0].parsedData.humanMessage).toContain(
        'Failed to get token info for a token',
      );
    }),
  );
});
