import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Client, PrivateKey, TokenId, AccountId, TokenSupplyType, PublicKey } from '@hashgraph/sdk';
import { AgentExecutor } from 'langchain/agents';
import {
  createLangchainTestSetup,
  getCustomClient,
  getOperatorClientForTests,
  HederaOperationsWrapper,
  type LangchainTestSetup,
} from '../utils';
import { extractObservationFromLangchainResponse, wait } from '../utils/general-util';
import { returnHbarsAndDeleteAccount } from '../utils/teardown/account-teardown';
import { MIRROR_NODE_WAITING_TIME } from '../utils/test-constants';
import { itWithRetry } from '../utils/retry-util';

describe('Get Token Info Query E2E Tests', () => {
  let operatorClient: Client;
  let executorClient: Client;
  let executorAccountId: AccountId;
  let executorWrapper: HederaOperationsWrapper;
  let tokenIdFT: TokenId;
  let testSetup: LangchainTestSetup;
  let agentExecutor: AgentExecutor;

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
    operatorClient = getOperatorClientForTests();
    const operatorWrapper = new HederaOperationsWrapper(operatorClient);

    const executorAccountKey = PrivateKey.generateED25519();
    executorAccountId = await operatorWrapper
      .createAccount({ key: executorAccountKey.publicKey, initialBalance: 100 })
      .then(resp => resp.accountId!);

    executorClient = getCustomClient(executorAccountId, executorAccountKey);
    testSetup = await createLangchainTestSetup(undefined, undefined, executorClient);
    agentExecutor = testSetup.agentExecutor;
    executorWrapper = new HederaOperationsWrapper(executorClient);
  });

  beforeEach(async () => {
    tokenIdFT = await executorWrapper
      .createFungibleToken({
        ...FT_PARAMS,
        supplyKey: executorClient.operatorPublicKey! as PublicKey,
        autoRenewAccountId: executorAccountId.toString(),
        adminKey: executorClient.operatorPublicKey! as PublicKey,
        treasuryAccountId: executorAccountId.toString(),
        metadataKey: operatorClient.operatorPublicKey! as PublicKey,
      })
      .then(resp => resp.tokenId!);

    await wait(MIRROR_NODE_WAITING_TIME);
  });

  afterAll(async () => {
    if (executorClient && operatorClient) {
      await returnHbarsAndDeleteAccount(
        executorWrapper,
        executorAccountId,
        operatorClient.operatorAccountId!,
      );
      executorClient.close();
      operatorClient.close();
    }
  });

  it(
    'should change token keys using passed values',
    itWithRetry(async () => {
      const newSupplyKey = PrivateKey.generateED25519().publicKey.toString();
      const newAdminKey = executorClient.operatorPublicKey!.toString();
      await agentExecutor.invoke({
        input: `For token ${tokenIdFT.toString()}, change the admin key to: ${newAdminKey} and the supply key to: ${newSupplyKey}.`,
      });

      const tokenDetails = await executorWrapper.getTokenInfo(tokenIdFT.toString());
      expect((tokenDetails.adminKey as PublicKey).toString()).toBe(newAdminKey);
      expect((tokenDetails.supplyKey as PublicKey).toString()).toBe(newSupplyKey);
    }),
  );

  it(
    'should change token keys using default values',
    itWithRetry(async () => {
      await agentExecutor.invoke({
        input: `For token ${tokenIdFT.toString()}, change the metadata key to my key and the token memo to 'just updated'`,
      });

      const tokenDetails = await executorWrapper.getTokenInfo(tokenIdFT.toString());
      expect((tokenDetails.metadataKey as PublicKey).toStringDer()).toBe(
        executorClient.operatorPublicKey!.toStringDer(),
      );
      expect(tokenDetails.tokenMemo).toBe('just updated');
    }),
  );

  it(
    'should fail due to token being originally created without KYC key',
    itWithRetry(async () => {
      const queryResult = await agentExecutor.invoke({
        input: `For token ${tokenIdFT.toString()}, change the KYC key to my key`,
      });

      const observation = extractObservationFromLangchainResponse(queryResult);

      expect(observation.humanMessage).toContain(
        'Failed to update token: Cannot update kycKey: token was created without a kycKey',
      );
      expect(observation.raw.error).toContain(
        'Failed to update token: Cannot update kycKey: token was created without a kycKey',
      );
    }),
  );

  it(
    'should update metadata and token memo',
    itWithRetry(async () => {
      const metadataString = 'hello-world';

      await agentExecutor.invoke({
        input: `For token ${tokenIdFT.toString()}, set the metadata to "${metadataString}" and the token memo to "metadata updated".`,
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
        .createAccount({ key: executorClient.operatorPublicKey!, initialBalance: 20 })
        .then(resp => resp.accountId!);
      await agentExecutor.invoke({
        input: `For token ${tokenIdFT.toString()} set auto renew account id to ${secondaryAccountId.toString()}.`,
      });

      const tokenDetails = await executorWrapper.getTokenInfo(tokenIdFT.toString());

      expect(tokenDetails.autoRenewAccountId?.toString()).toBe(secondaryAccountId.toString());
    }),
  );

  it(
    'should reject updates by an unauthorized operator',
    itWithRetry(async () => {
      const secondaryAccount = PrivateKey.generateED25519();
      const secondaryAccountId = await executorWrapper
        .createAccount({ key: secondaryAccount.publicKey, initialBalance: 20 })
        .then(resp => resp.accountId!);

      const secondaryClient = getCustomClient(secondaryAccountId, secondaryAccount);
      const secondaryWrapper = new HederaOperationsWrapper(secondaryClient);
      const tokenId = await secondaryWrapper
        .createFungibleToken({
          ...FT_PARAMS,
          supplyKey: secondaryClient.operatorPublicKey! as PublicKey,
          adminKey: secondaryClient.operatorPublicKey! as PublicKey,
          treasuryAccountId: secondaryAccountId.toString(),
        })
        .then(resp => resp.tokenId!);

      await wait(MIRROR_NODE_WAITING_TIME);

      const queryResult = await agentExecutor.invoke({
        input: `For token ${tokenId.toString()}, change the admin key to my key`,
      });

      const observation = extractObservationFromLangchainResponse(queryResult);

      expect(observation.raw.error).toContain('You do not have permission to update this token.');
      expect(observation.humanMessage).toContain(
        'You do not have permission to update this token.',
      );

      await returnHbarsAndDeleteAccount(
        secondaryWrapper,
        secondaryAccountId,
        operatorClient.operatorAccountId!,
      );
    }),
  );
});
