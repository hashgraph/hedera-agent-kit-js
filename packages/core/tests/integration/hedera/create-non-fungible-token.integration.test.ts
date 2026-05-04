import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client, TokenType } from '@hiero-ledger/sdk';
import createNonFungibleTokenTool from '@/plugins/core-token-plugin/tools/non-fungible-token/create-non-fungible-token';
import { AgentMode, type Context } from '@/shared/configuration';
import {
  getProfile,
  HederaOperationsWrapper,
  type TestAccount,
} from '@hashgraph/hedera-agent-kit-tests';
import { z } from 'zod';
import { createNonFungibleTokenParameters } from '@/shared/parameter-schemas/token.zod';
import { MIRROR_NODE_WAITING_TIME } from '@hashgraph/hedera-agent-kit-tests';
import { wait } from '@hashgraph/hedera-agent-kit-tests';

describe('Create Non-Fungible Token Integration Tests', () => {
  const profile = getProfile();
  let operatorClient: Client;
  let executor: TestAccount;
  let executorClient: Client;
  let executorWrapper: HederaOperationsWrapper;
  let context: Context;

  beforeAll(async () => {
    ({ client: operatorClient } = profile.client.connectAs(profile.operator));

    executor = await profile.accounts.acquire({ tier: 'STANDARD' });
    ({ client: executorClient, wrapper: executorWrapper } = profile.client.connectAs(executor));

    context = {
      mode: AgentMode.AUTONOMOUS,
    };
  });

  afterAll(async () => {
    await profile.accounts.release(executor);
    operatorClient?.close();
    executorClient?.close();
  });

  describe('Valid Create Non-Fungible Token Scenarios', () => {
    it('should create an NFT with minimal params', async () => {
      const params: z.infer<ReturnType<typeof createNonFungibleTokenParameters>> = {
        tokenName: 'TestNFT',
        tokenSymbol: 'TNFT',
      } as any;

      const tool = createNonFungibleTokenTool(context);
      const result: any = await tool.execute(operatorClient, context, params);

      const tokenInfo = await executorWrapper.getTokenInfo(result.raw.tokenId!.toString());

      expect(result.humanMessage).toContain('Token created successfully');
      expect(result.raw.transactionId).toBeDefined();
      expect(result.raw.tokenId).toBeDefined();
      expect(tokenInfo.name).toBe(params.tokenName);
      expect(tokenInfo.symbol).toBe(params.tokenSymbol);
      expect(tokenInfo.tokenType).toBe(TokenType.NonFungibleUnique);
      expect(tokenInfo.maxSupply?.toInt()).toBe(100); // default maxSupply
    });

    it('should create an NFT with custom max supply', async () => {
      const params: z.infer<ReturnType<typeof createNonFungibleTokenParameters>> = {
        tokenName: 'LimitedNFT',
        tokenSymbol: 'LNFT',
        maxSupply: 50,
      } as any;

      const tool = createNonFungibleTokenTool(context);
      const result: any = await tool.execute(operatorClient, context, params);

      const tokenInfo = await executorWrapper.getTokenInfo(result.raw.tokenId!.toString());

      expect(result.humanMessage).toContain('Token created successfully');
      expect(tokenInfo.name).toBe(params.tokenName);
      expect(tokenInfo.tokenType).toBe(TokenType.NonFungibleUnique);
      expect(tokenInfo.symbol).toBe(params.tokenSymbol);
      expect(tokenInfo.maxSupply?.toInt()).toBe(params.maxSupply);
    });

    it('should create an NFT with treasury account', async () => {
      const params: z.infer<ReturnType<typeof createNonFungibleTokenParameters>> = {
        tokenName: 'TreasuryNFT',
        tokenSymbol: 'TRFNFT',
        treasuryAccountId: executor.accountId.toString(),
        maxSupply: 200,
      } as any;

      const tool = createNonFungibleTokenTool(context);
      const result: any = await tool.execute(executorClient, context, params);

      const tokenInfo = await executorWrapper.getTokenInfo(result.raw.tokenId!.toString());

      expect(result.humanMessage).toContain('Token created successfully');
      expect(tokenInfo.treasuryAccountId?.toString()).toBe(params.treasuryAccountId);
      expect(tokenInfo.tokenType).toBe(TokenType.NonFungibleUnique);
      expect(tokenInfo.maxSupply?.toInt()).toBe(params.maxSupply);
    });

    it('Should schedule creation of an NFT', async () => {
      const params: z.infer<ReturnType<typeof createNonFungibleTokenParameters>> = {
        tokenName: 'TreasuryNFT',
        tokenSymbol: 'TRFNFT',
        treasuryAccountId: executor.accountId.toString(),
        maxSupply: 200,
        schedulingParams: {
          isScheduled: true,
          adminKey: false,
          waitForExpiry: false,
        },
      };

      await wait(MIRROR_NODE_WAITING_TIME);
      const tool = createNonFungibleTokenTool(context);
      const result: any = await tool.execute(executorClient, context, params);

      expect(result.humanMessage).toContain('Scheduled transaction created successfully.');
      expect(result.raw.scheduleId).toBeDefined();
      expect(result.raw.transactionId).toBeDefined();
    });

    it('should create an NFT with infinite supply type', async () => {
      const params: z.infer<ReturnType<typeof createNonFungibleTokenParameters>> = {
        tokenName: 'InfiniteNFT',
        tokenSymbol: 'INFNFT',
        supplyType: 'infinite',
      } as any;

      const tool = createNonFungibleTokenTool(context);
      const result: any = await tool.execute(operatorClient, context, params);

      const tokenInfo = await executorWrapper.getTokenInfo(result.raw.tokenId!.toString());

      expect(result.humanMessage).toContain('Token created successfully');
      expect(tokenInfo.name).toBe(params.tokenName);
      expect(tokenInfo.symbol).toBe(params.tokenSymbol);
      expect(tokenInfo.tokenType).toBe(TokenType.NonFungibleUnique);
      expect(tokenInfo.supplyType?.toString()).toBe('INFINITE');
      expect(tokenInfo.maxSupply?.toInt()).toBe(0); // infinite supply has maxSupply of 0
    });

    it('should create an NFT with explicit finite supply type and default maxSupply', async () => {
      const params: z.infer<ReturnType<typeof createNonFungibleTokenParameters>> = {
        tokenName: 'FiniteNFT',
        tokenSymbol: 'FINNFT',
        supplyType: 'finite',
      } as any;

      const tool = createNonFungibleTokenTool(context);
      const result: any = await tool.execute(operatorClient, context, params);

      const tokenInfo = await executorWrapper.getTokenInfo(result.raw.tokenId!.toString());

      expect(result.humanMessage).toContain('Token created successfully');
      expect(tokenInfo.name).toBe(params.tokenName);
      expect(tokenInfo.symbol).toBe(params.tokenSymbol);
      expect(tokenInfo.tokenType).toBe(TokenType.NonFungibleUnique);
      expect(tokenInfo.supplyType?.toString()).toBe('FINITE');
      expect(tokenInfo.maxSupply?.toInt()).toBe(100); // default maxSupply
    });

    it('should create an NFT with finite supply type and custom maxSupply', async () => {
      const params: z.infer<ReturnType<typeof createNonFungibleTokenParameters>> = {
        tokenName: 'CustomFiniteNFT',
        tokenSymbol: 'CFNFT',
        supplyType: 'finite',
        maxSupply: 300,
      } as any;

      const tool = createNonFungibleTokenTool(context);
      const result: any = await tool.execute(operatorClient, context, params);

      const tokenInfo = await executorWrapper.getTokenInfo(result.raw.tokenId!.toString());

      expect(result.humanMessage).toContain('Token created successfully');
      expect(tokenInfo.name).toBe(params.tokenName);
      expect(tokenInfo.symbol).toBe(params.tokenSymbol);
      expect(tokenInfo.tokenType).toBe(TokenType.NonFungibleUnique);
      expect(tokenInfo.supplyType?.toString()).toBe('FINITE');
      expect(tokenInfo.maxSupply?.toInt()).toBe(300);
    });

    it('should prioritize maxSupply over infinite supplyType (makes it finite)', async () => {
      const params: z.infer<ReturnType<typeof createNonFungibleTokenParameters>> = {
        tokenName: 'PriorityNFT',
        tokenSymbol: 'PRNFT',
        supplyType: 'infinite',
        maxSupply: 150,
      } as any;

      const tool = createNonFungibleTokenTool(context);
      const result: any = await tool.execute(operatorClient, context, params);

      const tokenInfo = await executorWrapper.getTokenInfo(result.raw.tokenId!.toString());

      expect(result.humanMessage).toContain('Token created successfully');
      expect(tokenInfo.name).toBe(params.tokenName);
      expect(tokenInfo.symbol).toBe(params.tokenSymbol);
      expect(tokenInfo.tokenType).toBe(TokenType.NonFungibleUnique);
      expect(tokenInfo.supplyType?.toString()).toBe('FINITE');
      expect(tokenInfo.maxSupply?.toInt()).toBe(150); // maxSupply takes priority
    });
  });

  describe('Invalid Scenarios', () => {
    it('should fail when required params are missing', async () => {
      const params: any = {}; // missing tokenName and tokenSymbol

      const tool = createNonFungibleTokenTool(context);
      const result: any = await tool.execute(executorClient, context, params);

      expect(result.humanMessage).toContain(
        'Invalid parameters: Field "tokenName" - Required; Field "tokenSymbol" - Required',
      );
      expect(result.raw.error).toContain(
        'Invalid parameters: Field "tokenName" - Required; Field "tokenSymbol" - Required',
      );
      expect(result.raw.status).toBeDefined();
    });

    it('should fail when tokenName is missing', async () => {
      const params: any = {
        tokenSymbol: 'INCOMPLETE',
      };

      const tool = createNonFungibleTokenTool(context);
      const result: any = await tool.execute(executorClient, context, params);

      expect(result.humanMessage).toContain('Invalid parameters: Field "tokenName" - Required');
      expect(result.raw.error).toContain('Invalid parameters: Field "tokenName" - Required');
      expect(result.raw.status).toBeDefined();
    });

    it('should fail when tokenSymbol is missing', async () => {
      const params: any = {
        tokenName: 'IncompleteNFT',
      };

      const tool = createNonFungibleTokenTool(context);
      const result: any = await tool.execute(executorClient, context, params);

      expect(result.humanMessage).toContain('Invalid parameters: Field "tokenSymbol" - Required');
      expect(result.raw.error).toContain('Invalid parameters: Field "tokenSymbol" - Required');
      expect(result.raw.status).toBeDefined();
    });
  });
});
