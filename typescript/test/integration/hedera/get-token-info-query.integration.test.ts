import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  Client,
  PrivateKey,
  AccountId,
  TokenId,
  PublicKey,
  TokenSupplyType,
  TokenType,
} from '@hashgraph/sdk';
import getTokenInfoQueryTool from '@/plugins/core-token-query-plugin/tools/queries/get-token-info-query';
import { Context, AgentMode } from '@/shared/configuration';
import { getOperatorClientForTests, getCustomClient, HederaOperationsWrapper } from '../../utils';
import { z } from 'zod';
import { tokenInfoQueryParameters } from '@/shared/parameter-schemas/token.zod';
import { wait } from '../../utils/general-util';
import { returnHbarsAndDeleteAccount } from '../../utils/teardown/account-teardown';
import { toDisplayUnit } from '@/shared/hedera-utils/decimals-utils';
import { MIRROR_NODE_WAITING_TIME } from '../../utils/test-constants';

describe('Get Token Info Query Integration Tests', () => {
  let operatorClient: Client;
  let executorClient: Client;
  let context: Context;
  let executorAccountId: AccountId;
  let executorWrapper: HederaOperationsWrapper;
  let tokenIdNFT: TokenId;
  let tokenIdFT: TokenId;

  // --- Constants for token creation ---
  const FT_PARAMS = {
    tokenName: 'FungibleToken',
    tokenSymbol: 'FUN',
    tokenMemo: 'FT',
    initialSupply: 1000, // in base denomination
    decimals: 2,
    maxSupply: 10000, // in base denomination
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
      .createAccount({ key: executorAccountKey.publicKey, initialBalance: 20 })
      .then(resp => resp.accountId!);

    executorClient = getCustomClient(executorAccountId, executorAccountKey);
    executorWrapper = new HederaOperationsWrapper(executorClient);

    context = {
      mode: AgentMode.AUTONOMOUS,
      accountId: executorClient.operatorAccountId!.toString(),
    };

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

  it('should return token info for a newly created fungible token', async () => {
    const tool = getTokenInfoQueryTool(context);
    const params: z.infer<ReturnType<typeof tokenInfoQueryParameters>> = {
      tokenId: tokenIdFT.toString(),
    };

    const result: any = await tool.execute(executorClient, context, params);

    // Human-readable response checks
    expect(result.humanMessage).toContain(`details for token **${tokenIdFT.toString()}**`);
    expect(result.humanMessage).toContain(`Token Name**: ${FT_PARAMS.tokenName}`);
    expect(result.humanMessage).toContain(`Token Symbol**: ${FT_PARAMS.tokenSymbol}`);
    expect(result.humanMessage).toContain(`Decimals**: ${FT_PARAMS.decimals}`);
    expect(result.humanMessage).toContain(`Treasury Account ID**: ${executorAccountId.toString()}`);
    expect(result.humanMessage).toContain('Status (Deleted/Active)**: Active');
    expect(result.humanMessage).toContain(
      `**Current Supply**: ${toDisplayUnit(FT_PARAMS.initialSupply, FT_PARAMS.decimals)}`,
    );
    expect(result.humanMessage).toContain(
      `**Max Supply**: ${toDisplayUnit(FT_PARAMS.maxSupply, FT_PARAMS.decimals)}`,
    );

    // Raw response checks
    expect(result.raw.tokenInfo.name).toBe(FT_PARAMS.tokenName);
    expect(result.raw.tokenInfo.symbol).toBe(FT_PARAMS.tokenSymbol);
    expect(result.raw.tokenInfo.decimals).toBe(String(FT_PARAMS.decimals));
    expect(result.raw.tokenInfo.memo).toBe(FT_PARAMS.tokenMemo);
    expect(result.raw.tokenInfo.deleted).toBe(false);
    expect(result.raw.tokenInfo.treasury_account_id).toBe(executorAccountId.toString());
    expect(result.raw.tokenInfo.total_supply).toBe(String(FT_PARAMS.initialSupply));
    expect(result.raw.tokenInfo.max_supply).toBe(String(FT_PARAMS.maxSupply));
    expect(result.raw.tokenInfo.supply_type?.toUpperCase()).toBe(
      FT_PARAMS.supplyType.toString().toUpperCase(),
    );
  });

  it('should return token info for a newly created non-fungible token', async () => {
    const tool = getTokenInfoQueryTool(context);
    const params: z.infer<ReturnType<typeof tokenInfoQueryParameters>> = {
      tokenId: tokenIdNFT.toString(),
    };

    const result: any = await tool.execute(executorClient, context, params);

    // Human-readable response checks
    expect(result.humanMessage).toContain(`details for token **${tokenIdNFT.toString()}**`);
    expect(result.humanMessage).toContain(`Token Name**: ${NFT_PARAMS.tokenName}`);
    expect(result.humanMessage).toContain(`Token Symbol**: ${NFT_PARAMS.tokenSymbol}`);
    expect(result.humanMessage).toContain('Token Type**: NON_FUNGIBLE_UNIQUE');
    expect(result.humanMessage).toContain(`Treasury Account ID**: ${executorAccountId.toString()}`);
    expect(result.humanMessage).toContain('Status (Deleted/Active)**: Active');
    expect(result.humanMessage).toContain(`**Max Supply**: ${NFT_PARAMS.maxSupply}`);
    expect(result.humanMessage).toContain('Memo**: NFT');
    expect(result.humanMessage).toContain('Admin Key:');
    expect(result.humanMessage).toContain('Supply Key:');
    expect(result.humanMessage).toContain('Wipe Key: Not Set');
    expect(result.humanMessage).toContain('KYC Key: Not Set');
    expect(result.humanMessage).toContain('Freeze Key: Not Set');

    // Raw response checks
    expect(result.raw.tokenInfo.name).toBe(NFT_PARAMS.tokenName);
    expect(result.raw.tokenInfo.symbol).toBe(NFT_PARAMS.tokenSymbol);
    expect(result.raw.tokenInfo.memo).toBe(NFT_PARAMS.tokenMemo);
    expect(result.raw.tokenInfo.type).toBe('NON_FUNGIBLE_UNIQUE');
    expect(result.raw.tokenInfo.admin_key).toBeDefined();
    expect(result.raw.tokenInfo.supply_key).toBeDefined();
    expect(result.raw.tokenInfo.wipe_key).toBeNull();
    expect(result.raw.tokenInfo.kyc_key).toBeNull();
    expect(result.raw.tokenInfo.freeze_key).toBeNull();
    expect(result.raw.tokenInfo.max_supply).toBe(String(NFT_PARAMS.maxSupply));
  });

  it('should fail gracefully for non-existent token', async () => {
    const tool = getTokenInfoQueryTool(context);
    const params: z.infer<ReturnType<typeof tokenInfoQueryParameters>> = {
      tokenId: '0.0.999999999',
    };

    const result: any = await tool.execute(executorClient, context, params);

    expect(result.humanMessage).toContain('Failed to get token info');
    expect(result.raw.error).toBeDefined();
  });

  it('should handle deleted token correctly', async () => {
    // Create a temporary token to delete
    const tempTokenId = await executorWrapper
      .createFungibleToken({
        tokenName: 'TempToken',
        tokenSymbol: 'TEMP',
        tokenMemo: 'Temporary token',
        initialSupply: 50,
        decimals: 0,
        supplyType: TokenSupplyType.Finite,
        maxSupply: 100,
        supplyKey: executorClient.operatorPublicKey! as PublicKey,
        autoRenewAccountId: executorAccountId.toString(),
        adminKey: executorClient.operatorPublicKey! as PublicKey,
        treasuryAccountId: executorAccountId.toString(),
      })
      .then(resp => resp.tokenId!);

    await wait(MIRROR_NODE_WAITING_TIME);

    await executorWrapper.deleteToken({ tokenId: tempTokenId.toString() });
    await wait(MIRROR_NODE_WAITING_TIME);

    const tool = getTokenInfoQueryTool(context);
    const params: z.infer<ReturnType<typeof tokenInfoQueryParameters>> = {
      tokenId: tempTokenId.toString(),
    };

    const result: any = await tool.execute(executorClient, context, params);

    expect(result.raw.tokenInfo.deleted).toBe(true);
    expect(result.humanMessage).toContain('Status (Deleted/Active)**: Deleted');
  });
});
