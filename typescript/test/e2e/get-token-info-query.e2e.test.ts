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
import { ReactAgent } from 'langchain';
import {
  createLangchainTestSetup,
  getCustomClient,
  getOperatorClientForTests,
  HederaOperationsWrapper,
  type LangchainTestSetup,
} from '../utils';
import { wait } from '../utils/general-util';
import { returnHbarsAndDeleteAccount } from '../utils/teardown/account-teardown';
import { toDisplayUnit } from '@/shared/hedera-utils/decimals-utils';
import { MIRROR_NODE_WAITING_TIME } from '../utils/test-constants';
import { itWithRetry } from '../utils/retry-util';
import { ResponseParserService } from '@/langchain';

describe('Get Token Info Query E2E Tests', () => {
  let operatorClient: Client;
  let executorClient: Client;
  let executorAccountId: AccountId;
  let executorWrapper: HederaOperationsWrapper;
  let tokenIdNFT: TokenId;
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
    agent = testSetup.agent;
    responseParsingService = testSetup.responseParser;
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
      const input = `Get token information for ${tokenIdFT.toString()}`;
      const result = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: input,
          },
        ],
      });

      const parsedResponse = responseParsingService.parseNewToolMessages(result);

      // Human-readable response checks
      expect(parsedResponse[0].parsedData.humanMessage).toContain(
        `details for token **${tokenIdFT.toString()}**`,
      );
      expect(parsedResponse[0].parsedData.humanMessage).toContain(
        `Token Name**: ${FT_PARAMS.tokenName}`,
      );
      expect(parsedResponse[0].parsedData.humanMessage).toContain(
        `Token Symbol**: ${FT_PARAMS.tokenSymbol}`,
      );
      expect(parsedResponse[0].parsedData.humanMessage).toContain(
        `Decimals**: ${FT_PARAMS.decimals}`,
      );
      expect(parsedResponse[0].parsedData.humanMessage).toContain(
        `Treasury Account ID**: ${executorAccountId.toString()}`,
      );
      expect(parsedResponse[0].parsedData.humanMessage).toContain(
        'Status (Deleted/Active)**: Active',
      );

      // Raw response checks
      expect(parsedResponse[0].parsedData.raw.tokenInfo.name).toBe(FT_PARAMS.tokenName);
      expect(parsedResponse[0].parsedData.raw.tokenInfo.symbol).toBe(FT_PARAMS.tokenSymbol);
      expect(parsedResponse[0].parsedData.raw.tokenInfo.decimals).toBe(String(FT_PARAMS.decimals));
      expect(parsedResponse[0].parsedData.raw.tokenInfo.memo).toBe(FT_PARAMS.tokenMemo);
      expect(parsedResponse[0].parsedData.raw.tokenInfo.deleted).toBe(false);
      expect(parsedResponse[0].parsedData.raw.tokenInfo.treasury_account_id).toBe(
        executorAccountId.toString(),
      );
    }),
  );

  it(
    'should return token info with formatted supply amounts',
    itWithRetry(async () => {
      const input = `Show me details for token ${tokenIdFT.toString()}`;
      const result = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: input,
          },
        ],
      });

      const parsedResponse = responseParsingService.parseNewToolMessages(result);

      // Human-readable response checks
      expect(parsedResponse[0].parsedData.humanMessage).toContain(
        `**Current Supply**: ${toDisplayUnit(FT_PARAMS.initialSupply, FT_PARAMS.decimals)}`,
      );
      expect(parsedResponse[0].parsedData.humanMessage).toContain(
        `**Max Supply**: ${toDisplayUnit(FT_PARAMS.maxSupply, FT_PARAMS.decimals)}`,
      );

      // Raw response checks
      expect(parsedResponse[0].parsedData.raw.tokenInfo.total_supply).toBe(
        String(FT_PARAMS.initialSupply),
      );
      expect(parsedResponse[0].parsedData.raw.tokenInfo.max_supply).toBe(
        String(FT_PARAMS.maxSupply),
      );
      expect(parsedResponse[0].parsedData.raw.tokenInfo.supply_type?.toUpperCase()).toBe(
        FT_PARAMS.supplyType.toString().toUpperCase(),
      );
    }),
  );

  it(
    'should fail gracefully for non-existent token',
    itWithRetry(async () => {
      const fakeTokenId = '0.0.999999999';

      const input = `Get token info for ${fakeTokenId}`;
      const result = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: input,
          },
        ],
      });

      const parsedResponse = responseParsingService.parseNewToolMessages(result);

      expect(parsedResponse[0].parsedData.humanMessage).toContain('Failed to get token info');
      expect(parsedResponse[0].parsedData.raw.error).toBeDefined();
    }),
  );

  it(
    'should handle tokens with different key configurations',
    itWithRetry(async () => {
      const input = `Query information for token ${tokenIdNFT.toString()}`;
      const result = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: input,
          },
        ],
      });

      const parsedResponse = responseParsingService.parseNewToolMessages(result);

      // Human-readable response checks
      expect(parsedResponse[0].parsedData.humanMessage).toContain(
        `details for token **${tokenIdNFT.toString()}**`,
      );
      expect(parsedResponse[0].parsedData.humanMessage).toContain('Admin Key:');
      expect(parsedResponse[0].parsedData.humanMessage).toContain('Supply Key:');
      expect(parsedResponse[0].parsedData.humanMessage).toContain('Wipe Key: Not Set');
      expect(parsedResponse[0].parsedData.humanMessage).toContain('KYC Key: Not Set');
      expect(parsedResponse[0].parsedData.humanMessage).toContain('Freeze Key: Not Set');

      // Raw response checks
      expect(parsedResponse[0].parsedData.raw.tokenInfo.name).toBe(NFT_PARAMS.tokenName);
      expect(parsedResponse[0].parsedData.raw.tokenInfo.symbol).toBe(NFT_PARAMS.tokenSymbol);
      expect(parsedResponse[0].parsedData.raw.tokenInfo.memo).toBe(NFT_PARAMS.tokenMemo);
      expect(parsedResponse[0].parsedData.raw.tokenInfo.type).toBe('NON_FUNGIBLE_UNIQUE');
      expect(parsedResponse[0].parsedData.raw.tokenInfo.admin_key).toBeDefined();
      expect(parsedResponse[0].parsedData.raw.tokenInfo.supply_key).toBeDefined();
      expect(parsedResponse[0].parsedData.raw.tokenInfo.wipe_key).toBeNull();
      expect(parsedResponse[0].parsedData.raw.tokenInfo.kyc_key).toBeNull();
      expect(parsedResponse[0].parsedData.raw.tokenInfo.freeze_key).toBeNull();
      expect(parsedResponse[0].parsedData.raw.tokenInfo.max_supply).toBe(
        String(NFT_PARAMS.maxSupply),
      );
    }),
  );
});
