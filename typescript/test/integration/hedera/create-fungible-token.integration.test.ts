import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from '@hashgraph/sdk';
import createFungibleTokenTool from '@/plugins/core-token-plugin/tools/fungible-token/create-fungible-token';
import { Context, AgentMode } from '@/shared/configuration';
import { getOperatorClientForTests, HederaOperationsWrapper } from '../../utils';
import { z } from 'zod';
import { createFungibleTokenParameters } from '@/shared/parameter-schemas/token.zod';
import { toDisplayUnit } from '@/shared/hedera-utils/decimals-utils';
import { wait } from '../../utils/general-util';
import { MIRROR_NODE_WAITING_TIME } from '../../utils/test-constants';

describe('Create Fungible Token Integration Tests', () => {
  let client: Client;
  let context: Context;
  let hederaOperationsWrapper: HederaOperationsWrapper;

  beforeAll(async () => {
    client = getOperatorClientForTests();
    hederaOperationsWrapper = new HederaOperationsWrapper(client);

    context = {
      mode: AgentMode.AUTONOMOUS,
      accountId: client.operatorAccountId!.toString(),
    };
  });

  afterAll(async () => {
    if (client) {
      client.close();
    }
  });

  describe('Valid Create Fungible Token Scenarios', () => {
    it('should create a fungible token with minimal params', async () => {
      const params: z.infer<ReturnType<typeof createFungibleTokenParameters>> = {
        tokenName: 'TestToken',
        tokenSymbol: 'TTK',
      } as any;

      const tool = createFungibleTokenTool(context);
      const result: any = await tool.execute(client, context, params);

      const tokenInfo = await hederaOperationsWrapper.getTokenInfo(result.raw.tokenId!.toString());

      expect(result.humanMessage).toContain('Token created successfully');
      expect(result.raw.transactionId).toBeDefined();
      expect(result.raw.tokenId).toBeDefined();
      expect(tokenInfo.name).toBe(params.tokenName);
      expect(tokenInfo.symbol).toBe(params.tokenSymbol);
      expect(tokenInfo.decimals).toBe(0);
      expect(tokenInfo.totalSupply.toInt()).toBe(0);
    });

    it('should create a fungible token with supply, decimals, and supply type', async () => {
      const params: z.infer<ReturnType<typeof createFungibleTokenParameters>> = {
        tokenName: 'GoldCoin',
        tokenSymbol: 'GLD',
        initialSupply: 1000,
        decimals: 2,
        supplyType: 'finite',
        maxSupply: 5000,
      } as any;

      const tool = createFungibleTokenTool(context);
      const result: any = await tool.execute(client, context, params);

      const tokenInfo = await hederaOperationsWrapper.getTokenInfo(result.raw.tokenId!.toString());

      expect(result.humanMessage).toContain('Token created successfully');
      expect(tokenInfo.name).toBe(params.tokenName);
      expect(tokenInfo.symbol).toBe(params.tokenSymbol);
      expect(tokenInfo.decimals).toBe(params.decimals);
      expect(toDisplayUnit(tokenInfo.totalSupply.toInt(), tokenInfo.decimals).toNumber()).toBe(
        params.initialSupply,
      );
      expect(toDisplayUnit(tokenInfo.maxSupply?.toInt()!, tokenInfo.decimals).toNumber()).toBe(
        params.maxSupply,
      );
    });

    it('should create a fungible token with treasury account and supply key', async () => {
      const params: z.infer<ReturnType<typeof createFungibleTokenParameters>> = {
        tokenName: 'SupplyToken',
        tokenSymbol: 'SUP',
        treasuryAccountId: context.accountId!,
        isSupplyKey: true,
      } as any;

      const tool = createFungibleTokenTool(context);
      const result: any = await tool.execute(client, context, params);

      const tokenInfo = await hederaOperationsWrapper.getTokenInfo(result.raw.tokenId!.toString());

      expect(result.humanMessage).toContain('Token created successfully');
      expect(tokenInfo.treasuryAccountId?.toString()).toBe(params.treasuryAccountId);
      expect(tokenInfo.supplyKey!.toString()).toBe(client.operatorPublicKey?.toStringDer());
    });

    it('Should schedule creation of an NFT', async () => {
      const params: z.infer<ReturnType<typeof createFungibleTokenParameters>> = {
        tokenName: 'SupplyToken',
        tokenSymbol: 'SUP',
        treasuryAccountId: context.accountId!,
        isSupplyKey: true,
        schedulingParams: {
          isScheduled: true,
          adminKey: false,
          waitForExpiry: false,
        },
      } as any;

      await wait(MIRROR_NODE_WAITING_TIME);
      const tool = createFungibleTokenTool(context);
      const result: any = await tool.execute(client, context, params);

      expect(result.humanMessage).toContain('Scheduled transaction created successfully.');
      expect(result.raw.scheduleId).toBeDefined();
      expect(result.raw.transactionId).toBeDefined();
    });
  });

  describe('Invalid Scenarios', () => {
    it('should fail when required params are missing', async () => {
      const params: any = {}; // missing tokenName

      const tool = createFungibleTokenTool(context);
      const result: any = await tool.execute(client, context, params);

      expect(result.humanMessage).toContain(
        ' Invalid parameters: Field "tokenName" - Required; Field "tokenSymbol" - Required',
      );
      expect(result.raw.error).toContain(
        ' Invalid parameters: Field "tokenName" - Required; Field "tokenSymbol" - Required',
      );
      expect(result.raw.status).toBeDefined();
    });

    it('should fail when maxSupply < initialSupply', async () => {
      const params: z.infer<ReturnType<typeof createFungibleTokenParameters>> = {
        tokenName: 'BadToken',
        tokenSymbol: 'BAD',
        initialSupply: 2000,
        supplyType: 'finite',
        maxSupply: 1000,
      } as any;

      const tool = createFungibleTokenTool(context);
      const result: any = await tool.execute(client, context, params);

      expect(result.humanMessage).toContain('cannot exceed max supply');
      expect(result.raw.status).toBeDefined();
      expect(result.raw.error).toBeDefined();
    });
  });
});
