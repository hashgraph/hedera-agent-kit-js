import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AccountId, Client, PrivateKey, PublicKey } from '@hashgraph/sdk';
import { z } from 'zod';
import transferERC721Tool from '@/plugins/core-evm-plugin/tools/erc721/transfer-erc721';
import { Context, AgentMode } from '@/shared/configuration';
import { getCustomClient, getOperatorClientForTests, HederaOperationsWrapper } from '../../utils';
import {
  transferERC721Parameters,
  createERC721Parameters,
} from '@/shared/parameter-schemas/evm.zod';
import { returnHbarsAndDeleteAccount } from '../../utils/teardown/account-teardown';
import { MIRROR_NODE_WAITING_TIME } from '../../utils/test-constants';
import { wait } from '../../utils/general-util';

describe('Transfer ERC721 Integration Tests', () => {
  let operatorClient: Client;
  let executorClient: Client;
  let context: Context;
  let operatorWrapper: HederaOperationsWrapper;
  let executorWrapper: HederaOperationsWrapper;
  let testTokenAddress: string;
  let recipientAccountId: string;
  let nextTokenId: number = 0;

  beforeAll(async () => {
    operatorClient = getOperatorClientForTests();
    operatorWrapper = new HederaOperationsWrapper(operatorClient);

    const executorAccountKey = PrivateKey.generateED25519();
    const executorAccountId = await operatorWrapper
      .createAccount({
        initialBalance: 30, // For creating tokens and transfers
        key: executorAccountKey.publicKey,
      })
      .then(resp => resp.accountId!);
    executorClient = getCustomClient(executorAccountId, executorAccountKey);
    executorWrapper = new HederaOperationsWrapper(executorClient);

    recipientAccountId = await operatorWrapper
      .createAccount({
        initialBalance: 5,
        key: executorClient.operatorPublicKey as PublicKey,
      })
      .then(resp => resp.accountId!.toString());

    context = {
      mode: AgentMode.AUTONOMOUS,
      accountId: executorAccountId.toString(),
    };

    const createParams: z.infer<ReturnType<typeof createERC721Parameters>> = {
      tokenName: 'TestNFT',
      tokenSymbol: 'TNFT',
      baseURI: 'https://example.com/metadata/',
    };

    const createResult = await executorWrapper.createERC721(createParams);

    if (!createResult.erc721Address) {
      throw new Error('Failed to create test ERC721 token for transfers');
    }

    testTokenAddress = createResult.erc721Address;

    await wait(MIRROR_NODE_WAITING_TIME);
  });

  afterAll(async () => {
    if (operatorClient && executorClient) {
      await returnHbarsAndDeleteAccount(
        executorWrapper,
        AccountId.fromString(recipientAccountId),
        operatorClient.operatorAccountId!,
      );
      await returnHbarsAndDeleteAccount(
        executorWrapper,
        executorClient.operatorAccountId!,
        operatorClient.operatorAccountId!,
      );
      operatorClient.close();
      executorClient.close();
    }
  });

  const mintTokenForTransfer = async (): Promise<number> => {
    await executorWrapper.mintERC721({
      contractId: testTokenAddress,
      toAddress: context.accountId,
    });
    return nextTokenId++;
  };

  describe('Valid Transfer ERC721 Scenarios', () => {
    it('should transfer token to another account using Hedera addresses', async () => {
      const tokenId = await mintTokenForTransfer();
      nextTokenId = tokenId + 1;

      const params = {
        contractId: testTokenAddress,
        fromAddress: context.accountId,
        toAddress: recipientAccountId,
        tokenId,
      };

      const tool = transferERC721Tool(context);
      const result: any = await tool.execute(executorClient, context, params);

      expect(result.raw.status.toString()).toBe('SUCCESS');
      expect(result.raw.transactionId).toBeDefined();
    });

    it('should transfer token using EVM addresses', async () => {
      const tokenId = await mintTokenForTransfer();
      nextTokenId = tokenId + 1;

      const recipientInfo = await executorWrapper.getAccountInfo(recipientAccountId.toString());
      const recipientEvmAddress = recipientInfo.contractAccountId;

      const params = {
        contractId: testTokenAddress,
        fromAddress: context.accountId,
        toAddress: recipientEvmAddress || recipientAccountId.toString(),
        tokenId,
      };

      const tool = transferERC721Tool(context);
      const result: any = await tool.execute(executorClient, context, params);

      expect(result.raw.status.toString()).toBe('SUCCESS');
      expect(result.raw.transactionId).toBeDefined();
    });

    it('should handle transfer without explicit fromAddress', async () => {
      const tokenId = await mintTokenForTransfer();
      nextTokenId = tokenId + 1;

      const params: z.infer<ReturnType<typeof transferERC721Parameters>> = {
        contractId: testTokenAddress,
        toAddress: recipientAccountId,
        tokenId,
      };

      const tool = transferERC721Tool(context);
      const result: any = await tool.execute(executorClient, context, params);

      expect(result.raw.status.toString()).toBe('SUCCESS');
      expect(result.raw.transactionId).toBeDefined();
    });

    it('should schedule a transfer of ERC721 token to another account using Hedera addresses', async () => {
      const tokenId = await mintTokenForTransfer();
      nextTokenId = tokenId + 1;

      const params = {
        contractId: testTokenAddress,
        fromAddress: context.accountId,
        toAddress: recipientAccountId,
        tokenId,
        schedulingParams: {
          isScheduled: true,
        },
      };

      const tool = transferERC721Tool(context);
      const result: any = await tool.execute(executorClient, context, params);

      expect(result.humanMessage).toContain('Scheduled transfer of ERC721 successfully');
      expect(result.raw.scheduleId).toBeDefined();
    });
  });

  describe('Invalid Transfer ERC721 Scenarios', () => {
    it('should fail with missing params', async () => {
      const tool = transferERC721Tool(context);
      const result: any = await tool.execute(executorClient, context, {} as any);

      expect(result.humanMessage).toContain('Failed to transfer ERC721');
      expect(result.raw.error).toContain('Invalid parameters');
    });

    it('should fail with invalid contractId', async () => {
      const params = {
        contractId: 'invalid-id',
        toAddress: '0.0.9999',
        tokenId: 1,
      };
      const tool = transferERC721Tool(context);
      const result: any = await tool.execute(executorClient, context, params);

      expect(result.humanMessage).toContain('Failed to transfer ERC721');
    });

    it('should fail when transferring non-existent token', async () => {
      const params = {
        contractId: testTokenAddress,
        fromAddress: context.accountId,
        toAddress: recipientAccountId,
        tokenId: 999999,
      };

      const tool = transferERC721Tool(context);
      const result: any = await tool.execute(executorClient, context, params);

      expect(result.humanMessage).toContain('Failed to transfer ERC721');
    });
  });
});
