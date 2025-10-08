import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  Client,
  PrivateKey,
  TokenId,
  AccountId,
  TokenSupplyType,
  PublicKey,
  TokenType,
} from '@hashgraph/sdk';
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
import { toDisplayUnit } from '@/shared/hedera-utils/decimals-utils';
import { MIRROR_NODE_WAITING_TIME } from '../utils/test-constants';
import { itWithRetry } from '../utils/retry-util';

describe('Get Token Info Query E2E Tests', () => {
  let operatorClient: Client;
  let executorClient: Client;
  let executorAccountId: AccountId;
  let executorWrapper: HederaOperationsWrapper;
  let tokenIdNFT: TokenId;
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

  const NFT_PARAMS = {
    tokenName: 'NonFungibleToken',
    tokenSymbol: 'NFUN',
    tokenMemo: 'NFT',
    maxSupply: 100,
    supplyType: TokenSupplyType.Finite,
    tokenType: TokenType.NonFungibleUnique,
  };

  beforeAll(async () => {
    operatorClient = getOperatorClientForTests();
    const operatorWrapper = new HederaOperationsWrapper(operatorClient);

    const executorAccountKey = PrivateKey.generateED25519();
    executorAccountId = await operatorWrapper
      .createAccount({ key: executorAccountKey.publicKey, initialBalance: 15 })
      .then(resp => resp.accountId!);

    executorClient = getCustomClient(executorAccountId, executorAccountKey);
    testSetup = await createLangchainTestSetup(undefined, undefined, executorClient);
    agentExecutor = testSetup.agentExecutor;
    executorWrapper = new HederaOperationsWrapper(executorClient);

    tokenIdFT = await executorWrapper
      .createFungibleToken({
        ...FT_PARAMS,
        supplyKey: executorClient.operatorPublicKey! as PublicKey,
        autoRenewAccountId: executorAccountId.toString(),
        adminKey: executorClient.operatorPublicKey! as PublicKey,
        treasuryAccountId: executorAccountId.toString(),
      })
      .then(resp => resp.tokenId!);

    tokenIdNFT = await executorWrapper
      .createNonFungibleToken({
        ...NFT_PARAMS,
        supplyKey: executorClient.operatorPublicKey! as PublicKey,
        autoRenewAccountId: executorAccountId.toString(),
        adminKey: executorClient.operatorPublicKey! as PublicKey,
        treasuryAccountId: executorAccountId.toString(),
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
    'should return token info for a newly created fungible token',
    itWithRetry(async () => {
      const queryResult = await agentExecutor.invoke({
        input: `Get token information for ${tokenIdFT.toString()}`,
      });

      const observation = extractObservationFromLangchainResponse(queryResult);

      // Human-readable response checks
      expect(observation.humanMessage).toContain(`details for token **${tokenIdFT.toString()}**`);
      expect(observation.humanMessage).toContain(`Token Name**: ${FT_PARAMS.tokenName}`);
      expect(observation.humanMessage).toContain(`Token Symbol**: ${FT_PARAMS.tokenSymbol}`);
      expect(observation.humanMessage).toContain(`Decimals**: ${FT_PARAMS.decimals}`);
      expect(observation.humanMessage).toContain(
        `Treasury Account ID**: ${executorAccountId.toString()}`,
      );
      expect(observation.humanMessage).toContain('Status (Deleted/Active)**: Active');

      // Raw response checks
      expect(observation.raw.tokenInfo.name).toBe(FT_PARAMS.tokenName);
      expect(observation.raw.tokenInfo.symbol).toBe(FT_PARAMS.tokenSymbol);
      expect(observation.raw.tokenInfo.decimals).toBe(String(FT_PARAMS.decimals));
      expect(observation.raw.tokenInfo.memo).toBe(FT_PARAMS.tokenMemo);
      expect(observation.raw.tokenInfo.deleted).toBe(false);
      expect(observation.raw.tokenInfo.treasury_account_id).toBe(executorAccountId.toString());
    }),
  );

  it(
    'should return token info with formatted supply amounts',
    itWithRetry(async () => {
      const queryResult = await agentExecutor.invoke({
        input: `Show me details for token ${tokenIdFT.toString()}`,
      });

      const observation = extractObservationFromLangchainResponse(queryResult);

      // Human-readable response checks
      expect(observation.humanMessage).toContain(
        `**Current Supply**: ${toDisplayUnit(FT_PARAMS.initialSupply, FT_PARAMS.decimals)}`,
      );
      expect(observation.humanMessage).toContain(
        `**Max Supply**: ${toDisplayUnit(FT_PARAMS.maxSupply, FT_PARAMS.decimals)}`,
      );

      // Raw response checks
      expect(observation.raw.tokenInfo.total_supply).toBe(String(FT_PARAMS.initialSupply));
      expect(observation.raw.tokenInfo.max_supply).toBe(String(FT_PARAMS.maxSupply));
      expect(observation.raw.tokenInfo.supply_type?.toUpperCase()).toBe(
        FT_PARAMS.supplyType.toString().toUpperCase(),
      );
    }),
  );

  it(
    'should fail gracefully for non-existent token',
    itWithRetry(async () => {
      const fakeTokenId = '0.0.999999999';

      const queryResult = await agentExecutor.invoke({
        input: `Get token info for ${fakeTokenId}`,
      });

      const observation = extractObservationFromLangchainResponse(queryResult);

      expect(observation.humanMessage).toContain('Failed to get token info');
      expect(observation.raw.error).toBeDefined();
    }),
  );

  it(
    'should handle tokens with different key configurations',
    itWithRetry(async () => {
      const queryResult = await agentExecutor.invoke({
        input: `Query information for token ${tokenIdNFT.toString()}`,
      });

      const observation = extractObservationFromLangchainResponse(queryResult);

      // Human-readable response checks
      expect(observation.humanMessage).toContain(`details for token **${tokenIdNFT.toString()}**`);
      expect(observation.humanMessage).toContain('Admin Key:');
      expect(observation.humanMessage).toContain('Supply Key:');
      expect(observation.humanMessage).toContain('Wipe Key: Not Set');
      expect(observation.humanMessage).toContain('KYC Key: Not Set');
      expect(observation.humanMessage).toContain('Freeze Key: Not Set');

      // Raw response checks
      expect(observation.raw.tokenInfo.name).toBe(NFT_PARAMS.tokenName);
      expect(observation.raw.tokenInfo.symbol).toBe(NFT_PARAMS.tokenSymbol);
      expect(observation.raw.tokenInfo.memo).toBe(NFT_PARAMS.tokenMemo);
      expect(observation.raw.tokenInfo.type).toBe('NON_FUNGIBLE_UNIQUE');
      expect(observation.raw.tokenInfo.admin_key).toBeDefined();
      expect(observation.raw.tokenInfo.supply_key).toBeDefined();
      expect(observation.raw.tokenInfo.wipe_key).toBeNull();
      expect(observation.raw.tokenInfo.kyc_key).toBeNull();
      expect(observation.raw.tokenInfo.freeze_key).toBeNull();
      expect(observation.raw.tokenInfo.max_supply).toBe(String(NFT_PARAMS.maxSupply));
    }),
  );
});
