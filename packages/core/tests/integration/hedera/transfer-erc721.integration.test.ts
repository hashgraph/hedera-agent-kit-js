import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from '@hiero-ledger/sdk';
import { z } from 'zod';
import transferERC721Tool from '@/plugins/core-evm-plugin/tools/erc721/transfer-erc721';
import { AgentMode, type Context } from '@/shared/configuration';
import {
  getProfile,
  HederaOperationsWrapper,
  type TestAccount,
} from '@hashgraph/hedera-agent-kit-tests';
import {
  transferERC721Parameters,
  createERC721Parameters,
} from '@/shared/parameter-schemas/evm.zod';
import { waitForMirrorTx } from '@hashgraph/hedera-agent-kit-tests';

describe('Transfer ERC721 Integration Tests', () => {
  const profile = getProfile();
  let executor: TestAccount;
  let recipient: TestAccount;
  let executorClient: Client;
  let executorWrapper: HederaOperationsWrapper;
  let context: Context;
  let testTokenAddress: string;
  let recipientAccountId: string;
  let nextTokenId: number = 0;

  beforeAll(async () => {
    executor = await profile.accounts.acquire({ tier: 'STANDARD' });
    ({ client: executorClient, wrapper: executorWrapper } = profile.client.connectAs(executor));

    recipient = await profile.accounts.acquire({ tier: 'MINIMAL' });
    recipientAccountId = recipient.accountId.toString();

    context = {
      mode: AgentMode.AUTONOMOUS,
      accountId: executor.accountId.toString(),
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

    await waitForMirrorTx(executorWrapper, createResult.raw.transactionId);
  });

  afterAll(async () => {
    await profile.accounts.release(recipient);
    await profile.accounts.release(executor);
    executorClient?.close();
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
