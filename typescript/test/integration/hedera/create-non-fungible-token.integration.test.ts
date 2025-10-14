import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client, PrivateKey, TokenType } from '@hashgraph/sdk';
import createNonFungibleTokenTool from '@/plugins/core-token-plugin/tools/non-fungible-token/create-non-fungible-token';
import { Context, AgentMode } from '@/shared/configuration';
import { getCustomClient, getOperatorClientForTests, HederaOperationsWrapper } from '../../utils';
import { z } from 'zod';
import { createNonFungibleTokenParameters } from '@/shared/parameter-schemas/token.zod';
import { returnHbarsAndDeleteAccount } from '../../utils/teardown/account-teardown';
import { MIRROR_NODE_WAITING_TIME } from '../../utils/test-constants';
import { wait } from '../../utils/general-util';

describe('Create Non-Fungible Token Integration Tests', () => {
  let operatorClient: Client;
  let executorClient: Client;
  let context: Context;
  let operatorWrapper: HederaOperationsWrapper;
  let executorWrapper: HederaOperationsWrapper;

  beforeAll(async () => {
    operatorClient = getOperatorClientForTests();
    operatorWrapper = new HederaOperationsWrapper(operatorClient);

    const executorAccountKey = PrivateKey.generateED25519();
    const executorAccountId = await operatorWrapper
      .createAccount({
        initialBalance: 20, // For creating NFTs
        key: executorAccountKey.publicKey,
      })
      .then(resp => resp.accountId!);
    executorClient = getCustomClient(executorAccountId, executorAccountKey);
    executorWrapper = new HederaOperationsWrapper(executorClient);

    context = {
      mode: AgentMode.AUTONOMOUS,
    };
  });

  afterAll(async () => {
    if (operatorClient && executorClient) {
      await returnHbarsAndDeleteAccount(
        executorWrapper,
        executorClient.operatorAccountId!,
        operatorClient.operatorAccountId!,
      );
      operatorClient.close();
      executorClient.close();
    }
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
        treasuryAccountId: executorClient.operatorAccountId!.toString(),
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
        treasuryAccountId: executorClient.operatorAccountId!.toString(),
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
