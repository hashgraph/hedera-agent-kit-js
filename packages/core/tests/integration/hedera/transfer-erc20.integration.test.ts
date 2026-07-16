import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import {
  Client,
  ContractCallQuery,
  ContractFunctionParameters,
  ContractId,
} from '@hiero-ledger/sdk';
import { z } from 'zod';
import transferERC20Tool from '@/plugins/core-evm-plugin/tools/erc20/transfer-erc20';
import { AgentMode, type Context } from '@/shared/configuration';
import {
  getProfile,
  HederaOperationsWrapper,
  type TestAccount,
} from '@hashgraph/hedera-agent-kit-tests';
import { createERC20Parameters } from '@/shared/parameter-schemas/evm.zod';

describe('Transfer ERC20 Integration Tests', () => {
  const profile = getProfile();
  let executor: TestAccount;
  let executorClient: Client;
  let executorWrapper: HederaOperationsWrapper;
  let context: Context;
  let testTokenAddress: string;
  let recipient: TestAccount | undefined;
  let recipientAccountId: string;

  beforeAll(async () => {
    executor = await profile.accounts.acquire({ tier: 'STANDARD' });
    ({ client: executorClient, wrapper: executorWrapper } = profile.client.connectAs(executor));

    context = {
      mode: AgentMode.AUTONOMOUS,
      accountId: executor.accountId.toString(),
    };

    // Create a test ERC20 token with initial supply
    const createParams: z.infer<ReturnType<typeof createERC20Parameters>> = {
      tokenName: 'TestTransferToken',
      tokenSymbol: 'TTT',
      decimals: 18,
      initialSupply: 1000,
    };

    const createResult = await executorWrapper.createERC20(createParams);

    if (!createResult.erc20Address) {
      throw new Error('Failed to create test ERC20 token');
    }

    testTokenAddress = createResult.erc20Address;
  });

  afterAll(async () => {
    await profile.accounts.release(executor);
    executorClient?.close();
  });

  // Reads balanceOf(holder) straight from the consensus nodes, so the value is
  // consistent immediately after the transfer receipt (no mirror node ingestion lag).
  const getErc20Balance = async (holderEvmAddress: string): Promise<string> => {
    const result = await new ContractCallQuery()
      .setContractId(ContractId.fromEvmAddress(0, 0, testTokenAddress))
      .setGas(100_000)
      .setFunction('balanceOf', new ContractFunctionParameters().addAddress(holderEvmAddress))
      .execute(executorClient);
    return result.getUint256(0).toString();
  };

  describe('Valid Transfer ERC20 Scenarios', () => {
    afterEach(async () => {
      if (recipient) {
        await profile.accounts.release(recipient);
        recipient = undefined;
      }
    });

    it('should transfer tokens to another account using Hedera address', async () => {
      // Create a recipient account
      recipient = await profile.accounts.acquire({ tier: 'MINIMAL' });
      recipientAccountId = recipient.accountId.toString();

      const params = {
        contractId: testTokenAddress,
        recipientAddress: recipientAccountId,
        amount: 10,
      };

      const tool = transferERC20Tool(context);
      const result: any = await tool.execute(executorClient, context, params);

      expect(result.raw.status.toString()).toBe('SUCCESS');
      expect(result.raw.transactionId).toBeDefined();

      // 10 display units with 18 decimals must arrive as 10 * 10^18 base units
      const recipientInfo = await executorWrapper.getAccountInfo(recipientAccountId);
      expect(await getErc20Balance(recipientInfo.contractAccountId!)).toBe(
        10_000_000_000_000_000_000n.toString(),
      );
    });

    it('should transfer tokens using EVM addresses', async () => {
      // Create a recipient account and get its EVM address
      recipient = await profile.accounts.acquire({ tier: 'MINIMAL' });
      recipientAccountId = recipient.accountId.toString();

      // Get EVM address for the recipient
      const recipientInfo = await executorWrapper.getAccountInfo(recipientAccountId);
      const recipientEvmAddress = recipientInfo.contractAccountId;

      const params = {
        contractId: testTokenAddress,
        recipientAddress: recipientEvmAddress!,
        amount: 5,
      };

      const tool = transferERC20Tool(context);
      const result: any = await tool.execute(executorClient, context, params);

      expect(result.raw.status.toString()).toBe('SUCCESS');
      expect(result.raw.transactionId).toBeDefined();

      // 5 display units with 18 decimals must arrive as 5 * 10^18 base units
      expect(await getErc20Balance(recipientEvmAddress!)).toBe(
        5_000_000_000_000_000_000n.toString(),
      );
    });

    it('should schedule transfer of ERC20 tokens to another account using Hedera address', async () => {
      // Create a recipient account
      recipient = await profile.accounts.acquire({ tier: 'MINIMAL' });
      recipientAccountId = recipient.accountId.toString();

      const params = {
        contractId: testTokenAddress,
        recipientAddress: recipientAccountId,
        amount: 10,
        schedulingParams: {
          isScheduled: true,
        },
      };

      const tool = transferERC20Tool(context);
      const result: any = await tool.execute(executorClient, context, params);

      expect(result.humanMessage).toContain('Scheduled transfer of ERC20 successfully.');
      expect(result.raw.scheduleId).toBeDefined();
    });
  });

  describe('Invalid Transfer ERC20 Scenarios', () => {
    afterEach(async () => {
      if (recipient) {
        await profile.accounts.release(recipient);
        recipient = undefined;
      }
    });

    it('should fail when required params are missing', async () => {
      const params: any = {}; // no contractId, recipientAddress, amount

      const tool = transferERC20Tool(context);
      const result: any = await tool.execute(executorClient, context, params);

      expect(result.humanMessage).toContain('Failed to transfer ERC20');
      expect(result.raw.error).toContain('Failed to transfer ERC20');
      expect(result.raw.error).toContain('Invalid parameters');
    });

    it('should fail when contractId is invalid', async () => {
      const params: any = {
        contractId: 'invalid-contract-id',
        recipientAddress: '0.0.9999',
        amount: 10,
      };

      const tool = transferERC20Tool(context);
      const result: any = await tool.execute(executorClient, context, params);

      expect(result.raw.error).toContain('Failed to transfer ERC20');
      expect(result.humanMessage).toContain('Failed to transfer ERC20');
    });

    it('should fail when amount is negative', async () => {
      recipient = await profile.accounts.acquire({ tier: 'MINIMAL' });
      recipientAccountId = recipient.accountId.toString();

      const params: any = {
        contractId: testTokenAddress,
        recipientAddress: recipientAccountId,
        amount: -10,
      };

      const tool = transferERC20Tool(context);
      const result: any = await tool.execute(executorClient, context, params);

      expect(result.raw.error).toContain('Failed to transfer ERC20');
      expect(result.humanMessage).toContain('Failed to transfer ERC20');
    });

    it('should fail when recipientAddress is invalid', async () => {
      const params: any = {
        contractId: testTokenAddress,
        recipientAddress: 'invalid-address',
        amount: 10,
      };

      const tool = transferERC20Tool(context);
      const result: any = await tool.execute(executorClient, context, params);

      expect(result.raw.error).toContain('Failed to transfer ERC20');
      expect(result.humanMessage).toContain('Failed to transfer ERC20');
    });
  });
});
