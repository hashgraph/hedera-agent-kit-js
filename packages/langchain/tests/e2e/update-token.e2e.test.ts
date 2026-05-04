import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Client, PrivateKey, TokenId, TokenSupplyType, PublicKey } from '@hiero-ledger/sdk';
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

describe('Get Token Info Query E2E Tests', () => {
  const profile = getProfile();
  let executor: TestAccount;
  let executorClient: Client;
  let executorWrapper: HederaOperationsWrapper;
  let tokenIdFT: TokenId;
  let testSetup: LangchainTestSetup;
  let agent: ReactAgent;
  let responseParsingService: ResponseParserService;

  // --- Constants for token creation ---
  const FT_PARAMS = {
    tokenName: 'FungibleToken',
    tokenSymbol: 'FUN',
    tokenMemo: 'FT',
    initialSupply: 1000, // in base denomination (e.g., if decimals=2, 1000 = 10.00 tokens)
    decimals: 2,
    maxSupply: 10000, // in base denomination (e.g., if decimals=2, 10000 = 100.00 tokens)
    supplyType: TokenSupplyType.Finite,
  };

  beforeAll(async () => {
    executor = await profile.accounts.acquire({ tier: 'MAXIMUM' });
    ({ client: executorClient, wrapper: executorWrapper } = profile.client.connectAs(executor));

    testSetup = await createLangchainTestSetup(undefined, undefined, executorClient);
    agent = testSetup.agent;
    responseParsingService = testSetup.responseParser;
  });

  beforeEach(async () => {
    const createTokenResp = await executorWrapper.createFungibleToken({
      ...FT_PARAMS,
      supplyKey: executor.privateKey.publicKey as PublicKey,
      autoRenewAccountId: executor.accountId.toString(),
      adminKey: executor.privateKey.publicKey as PublicKey,
      treasuryAccountId: executor.accountId.toString(),
      metadataKey: profile.operator.privateKey.publicKey as PublicKey,
    });
    tokenIdFT = createTokenResp.tokenId!;

    await waitForMirrorTx(executorWrapper, createTokenResp.transactionId!);
  });

  afterAll(async () => {
    await profile.accounts.release(executor);
    testSetup?.cleanup();
    executorClient?.close();
  });

  it(
    'should change token keys using passed values',
    itWithRetry(async () => {
      const newSupplyKey = PrivateKey.generateED25519().publicKey.toString();
      const newAdminKey = executor.privateKey.publicKey.toString();
      await agent.invoke({
        messages: [
          {
            role: 'user',
            content: `For token ${tokenIdFT.toString()}
      ], change the admin key to: ${newAdminKey} and the supply key to: ${newSupplyKey}.`,
          },
        ],
      });

      const tokenDetails = await executorWrapper.getTokenInfo(tokenIdFT.toString());
      expect((tokenDetails.adminKey as PublicKey).toString()).toBe(newAdminKey);
      expect((tokenDetails.supplyKey as PublicKey).toString()).toBe(newSupplyKey);
    }),
  );

  it(
    'should change token keys using default values',
    itWithRetry(async () => {
      await agent.invoke({
        messages: [
          {
            role: 'user',
            content: `For token ${tokenIdFT.toString()}
      ], change the metadata key to my key and the token memo to 'just updated'`,
          },
        ],
      });

      const tokenDetails = await executorWrapper.getTokenInfo(tokenIdFT.toString());
      expect((tokenDetails.metadataKey as PublicKey).toStringDer()).toBe(
        executor.privateKey.publicKey.toStringDer(),
      );
      expect(tokenDetails.tokenMemo).toBe('just updated');
    }),
  );

  it(
    'should fail due to token being originally created without KYC key',
    itWithRetry(async () => {
      const queryResult = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: `For token ${tokenIdFT.toString()}
      ], change the KYC key to my key`,
          },
        ],
      });

      const parsedResponse = responseParsingService.parseNewToolMessages(queryResult);

      expect(parsedResponse[0].parsedData.humanMessage).toContain(
        'Failed to update token: Cannot update kycKey: token was created without a kycKey',
      );
      expect(parsedResponse[0].parsedData.raw.error).toContain(
        'Failed to update token: Cannot update kycKey: token was created without a kycKey',
      );
    }),
  );

  it(
    'should update metadata and token memo',
    itWithRetry(async () => {
      const metadataString = 'hello-world';

      await agent.invoke({
        messages: [
          {
            role: 'user',
            content: `For token ${tokenIdFT.toString()}
      ], set the metadata to "${metadataString}" and the token memo to "metadata updated".`,
          },
        ],
      });

      const tokenDetails = await executorWrapper.getTokenInfo(tokenIdFT.toString());
      expect(tokenDetails.tokenMemo).toBe('metadata updated');
      // metadata comes back as a base64 string in the mirror node
      const decoded = Buffer.from(tokenDetails.metadata as Uint8Array).toString('utf8');
      expect(decoded).toBe(metadataString);
    }),
  );

  // to set some account as the auto-renew account,
  // it must have the same public key as the account operating the agent,
  // so in this case we create a new account with a public key of an executor account
  it(
    'should update autoRenewAccountId',
    itWithRetry(async () => {
      const secondaryAccountId = await executorWrapper
        .createAccount({
          key: executor.privateKey.publicKey,
          initialBalance: profile.balance.fund('MINIMAL'),
        })
        .then(resp => resp.accountId!);
      await agent.invoke({
        messages: [
          {
            role: 'user',
            content: `For token ${tokenIdFT.toString()} set auto renew account id to ${secondaryAccountId.toString()}.`,
          },
        ],
      });

      const tokenDetails = await executorWrapper.getTokenInfo(tokenIdFT.toString());

      expect(tokenDetails.autoRenewAccountId?.toString()).toBe(secondaryAccountId.toString());
    }),
  );

  it(
    'should reject updates by an unauthorized operator',
    itWithRetry(async () => {
      const secondary = await profile.accounts.acquire({ tier: 'STANDARD' });
      const { client: secondaryClient, wrapper: secondaryWrapper } =
        profile.client.connectAs(secondary);

      const createSecondaryTokenResp = await secondaryWrapper.createFungibleToken({
        ...FT_PARAMS,
        supplyKey: secondary.privateKey.publicKey as PublicKey,
        adminKey: secondary.privateKey.publicKey as PublicKey,
        treasuryAccountId: secondary.accountId.toString(),
      });
      const tokenId = createSecondaryTokenResp.tokenId!;

      await waitForMirrorTx(secondaryWrapper, createSecondaryTokenResp.transactionId!);

      const queryResult = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: `For token ${tokenId.toString()} change the admin key to my key`,
          },
        ],
      });

      const parsedResponse = responseParsingService.parseNewToolMessages(queryResult);

      expect(parsedResponse[0].parsedData.raw.error).toContain(
        'You do not have permission to update this token.',
      );
      expect(parsedResponse[0].parsedData.humanMessage).toContain(
        'You do not have permission to update this token.',
      );

      await profile.accounts.release(secondary);
      secondaryClient.close();
    }),
  );
});
