import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { AccountId, Client, PrivateKey, PublicKey } from '@hashgraph/sdk';
import { z } from 'zod';
import transferERC20Tool from '@/plugins/core-evm-plugin/tools/erc20/transfer-erc20';
import { Context, AgentMode } from '@/shared/configuration';
import { getCustomClient, getOperatorClientForTests, HederaOperationsWrapper } from '../../utils';
import { createERC20Parameters } from '@/shared/parameter-schemas/evm.zod';
import { returnHbarsAndDeleteAccount } from '../../utils/teardown/account-teardown';
import { wait } from '../../utils/general-util';
import { MIRROR_NODE_WAITING_TIME } from '../../utils/test-constants';

describe('Transfer ERC20 Integration Tests', () => {
  let operatorClient: Client;
  let executorClient: Client;
  let context: Context;
  let operatorWrapper: HederaOperationsWrapper;
  let executorWrapper: HederaOperationsWrapper;
  let testTokenAddress: string;
  let recipientAccountId: string;

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

    context = {
      mode: AgentMode.AUTONOMOUS,
      accountId: executorAccountId.toString(),
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
    if (executorClient) {
      await returnHbarsAndDeleteAccount(
        executorWrapper,
        executorClient.operatorAccountId!,
        operatorClient.operatorAccountId!,
      );
      executorClient.close();
    }
    if (operatorClient) {
      operatorClient.close();
    }
  });

  describe('Valid Transfer ERC20 Scenarios', () => {
    afterEach(async () => {
      await returnHbarsAndDeleteAccount(
        executorWrapper,
        AccountId.fromString(recipientAccountId),
        executorClient.operatorAccountId!,
      );
    });

    it('should transfer tokens to another account using Hedera address', async () => {
      // Create a recipient account
      recipientAccountId = await operatorWrapper
        .createAccount({
          initialBalance: 5,
          key: executorClient.operatorPublicKey as PublicKey,
        })
        .then(resp => resp.accountId!.toString());

      await wait(MIRROR_NODE_WAITING_TIME);

      const params = {
        contractId: testTokenAddress,
        recipientAddress: recipientAccountId,
        amount: 10,
      };

      const tool = transferERC20Tool(context);
      const result: any = await tool.execute(executorClient, context, params);

      expect(result.raw.status.toString()).toBe('SUCCESS');
      expect(result.raw.transactionId).toBeDefined();
    });

    it('should transfer tokens using EVM addresses', async () => {
      // Create a recipient account and get its EVM address
      recipientAccountId = await operatorWrapper
        .createAccount({
          initialBalance: 5,
          key: executorClient.operatorPublicKey as PublicKey,
        })
        .then(resp => resp.accountId!.toString());

      await wait(MIRROR_NODE_WAITING_TIME);

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
    });

    it('should schedule transfer of ERC20 tokens to another account using Hedera address', async () => {
      // Create a recipient account
      recipientAccountId = await operatorWrapper
        .createAccount({
          initialBalance: 5,
          key: executorClient.operatorPublicKey as PublicKey,
        })
        .then(resp => resp.accountId!.toString());

      await wait(MIRROR_NODE_WAITING_TIME);

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
      recipientAccountId = await operatorWrapper
        .createAccount({
          initialBalance: 5,
          key: executorClient.operatorPublicKey as PublicKey,
        })
        .then(resp => resp.accountId!.toString());

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
