import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client, PublicKey, TokenId, TokenSupplyType } from '@hiero-ledger/sdk';

import { createLangchainTestSetup, type LangchainTestSetup } from '../utils';
import {
  getProfile,
  HederaOperationsWrapper,
  type TestAccount,
  wait,
  MIRROR_NODE_WAITING_TIME,
  itWithRetry,
} from '@hashgraph/hedera-agent-kit-tests';
import { ReactAgent } from 'langchain';
import { ResponseParserService } from '@hashgraph/hedera-agent-kit-langchain';

describe('Airdrop Fungible Token E2E Tests', () => {
  const profile = getProfile();
  let executor: TestAccount;
  let executorClient: Client;
  let executorWrapper: HederaOperationsWrapper;
  let tokenIdFT: TokenId;
  let testSetup: LangchainTestSetup;
  let agent: ReactAgent;
  let responseParsingService: ResponseParserService;
  const recipients: TestAccount[] = [];

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
    executor = await profile.accounts.acquire({
      tier: 'STANDARD',
      accountMemo: 'executor account for Airdrop Fungible Token E2E Tests',
    });
    ({ client: executorClient, wrapper: executorWrapper } = profile.client.connectAs(executor));

    // Setup agent
    testSetup = await createLangchainTestSetup(undefined, undefined, executorClient);
    agent = testSetup.agent;
    responseParsingService = testSetup.responseParser;

    // Deploy fungible token
    tokenIdFT = await executorWrapper
      .createFungibleToken({
        ...FT_PARAMS,
        supplyKey: executor.privateKey.publicKey as PublicKey,
        adminKey: executor.privateKey.publicKey as PublicKey,
        treasuryAccountId: executor.accountId.toString(),
        autoRenewAccountId: executor.accountId.toString(),
      })
      .then(resp => resp.tokenId!);

    await wait(MIRROR_NODE_WAITING_TIME);
  });

  afterAll(async () => {
    for (const recipient of recipients) {
      await profile.accounts.release(recipient);
    }
    await profile.accounts.release(executor);
    testSetup?.cleanup();
    executorClient?.close();
  });

  const createRecipientAccount = async () => {
    const recipient = await profile.accounts.acquire({
      preset: 'pending-airdrop-recipient',
      accountMemo: 'recipient account for Airdrop Fungible Token E2E Tests',
    });
    recipients.push(recipient);
    return recipient.accountId;
  };

  it(
    'should airdrop tokens to a single recipient successfully',
    itWithRetry(async () => {
      const recipientId = await createRecipientAccount();

      const queryResult = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: `Airdrop 50 of token ${tokenIdFT.toString()} from ${executor.accountId.toString()} to ${recipientId.toString()}`,
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
      const recipient1 = await createRecipientAccount();
      const recipient2 = await createRecipientAccount();

      const queryResult = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: `Airdrop 10 of token ${tokenIdFT.toString()} from ${executor.accountId.toString()} to ${recipient1.toString()} and 20 to ${recipient2.toString()}`,
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
      const recipientId = await createRecipientAccount();
      const fakeTokenId = '0.0.999999999';

      const queryResult = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: `Airdrop 5 of token ${fakeTokenId} from ${executor.accountId.toString()} to ${recipientId.toString()}`,
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
