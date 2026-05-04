import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client, PublicKey, TokenId, TokenSupplyType } from '@hiero-ledger/sdk';
import { ReactAgent } from 'langchain';
import { createLangchainTestSetup, type LangchainTestSetup } from '@tests/utils';
import {
  getProfile,
  HederaOperationsWrapper,
  type TestAccount,
  waitFor,
  itWithRetry,
} from '@hashgraph/hedera-agent-kit-tests';
import { ResponseParserService } from '@hashgraph/hedera-agent-kit-langchain';

describe('Get Pending Airdrop Query E2E Tests', () => {
  const profile = getProfile();
  let executor: TestAccount;
  let executorClient: Client;
  let executorWrapper: HederaOperationsWrapper;
  let tokenIdFT: TokenId;
  let testSetup: LangchainTestSetup;
  let agent: ReactAgent;
  let responseParsingService: ResponseParserService;
  let recipient: TestAccount;

  const FT_PARAMS = {
    tokenName: 'AirdropE2EToken',
    tokenSymbol: 'ADE',
    tokenMemo: 'FT-PENDING-E2E',
    initialSupply: 100000,
    decimals: 2,
    maxSupply: 500000,
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
      autoRenewAccountId: executor.accountId.toString(),
      adminKey: executor.privateKey.publicKey as PublicKey,
      treasuryAccountId: executor.accountId.toString(),
    });
    tokenIdFT = createTokenResp.tokenId!;

    // Recipient with no auto-assoc to create pending airdrop
    recipient = await profile.accounts.acquire({ preset: 'pending-airdrop-recipient' });

    await executorWrapper.airdropToken({
      tokenTransfers: [
        { tokenId: tokenIdFT.toString(), accountId: recipient.accountId.toString(), amount: 10 },
        { tokenId: tokenIdFT.toString(), accountId: executor.accountId.toString(), amount: -10 },
      ],
    });

    // Adaptive wait for the pending airdrop to appear in mirror
    await waitFor(
      async () => {
        const pending = await executorWrapper.getPendingAirdrops(recipient.accountId.toString());
        return pending.airdrops.length > 0 ? pending : null;
      },
      { timeoutMs: 10000, intervalMs: 250, description: 'pending airdrop to appear in mirror' },
    );
  });

  afterAll(async () => {
    await profile.accounts.release(recipient);
    await profile.accounts.release(executor);
    testSetup?.cleanup();
    executorClient?.close();
  });

  it(
    'should return pending airdrops for recipient via natural language',
    itWithRetry(async () => {
      const input = `Show pending airdrops for account ${recipient.accountId.toString()}`;
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
        `pending airdrops for account **${recipient.accountId.toString()}**`,
      );
      expect(Array.isArray(parsedResponse[0].parsedData.raw.pendingAirdrops.airdrops)).toBe(true);
      expect(parsedResponse[0].parsedData.raw.pendingAirdrops.airdrops.length).toBeGreaterThan(0);
    }),
  );
});
