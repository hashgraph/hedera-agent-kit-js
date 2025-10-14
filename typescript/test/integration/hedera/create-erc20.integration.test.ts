import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client, PrivateKey } from '@hashgraph/sdk';
import { z } from 'zod';
import createERC20Tool from '@/plugins/core-evm-plugin/tools/erc20/create-erc20';
import { Context, AgentMode } from '@/shared/configuration';
import { getCustomClient, getOperatorClientForTests, HederaOperationsWrapper } from '../../utils';
import { createERC20Parameters } from '@/shared/parameter-schemas/evm.zod';

describe('Create ERC20 Integration Tests', () => {
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
      accountId: executorAccountId.toString(),
    };
  });

  afterAll(async () => {
    if (executorClient) {
      executorClient.close();
    }
    if (operatorClient) {
      operatorClient.close();
    }
  });

  describe('Valid Create ERC20 Scenarios', () => {
    it('should deploy an ERC20 contract with minimal params', async () => {
      const params = {
        tokenName: 'TestERC20',
        tokenSymbol: 'TERC',
      };

      const tool = createERC20Tool(context);
      const result: any = await tool.execute(executorClient, context, params);

      expect(result.humanMessage).toContain('ERC20 token created successfully');
      expect(result.erc20Address).toMatch(/^0x[a-fA-F0-9]{40}$/);

      const contractInfo = await executorWrapper.getContractInfo(result.erc20Address);

      expect(contractInfo.contractId).toBeDefined();
      expect(contractInfo.adminKey).toBeDefined();
    });

    it('should deploy ERC20 with supply and decimals', async () => {
      const params: z.infer<ReturnType<typeof createERC20Parameters>> = {
        tokenName: 'GoldERC20',
        tokenSymbol: 'GLD',
        initialSupply: 5000,
        decimals: 8,
      };

      const tool = createERC20Tool(context);
      const result: any = await tool.execute(executorClient, context, params);

      expect(result.humanMessage).toContain('ERC20 token created successfully');
      expect(result.erc20Address).toMatch(/^0x[a-fA-F0-9]{40}$/);

      const contractInfo = await executorWrapper.getContractInfo(result.erc20Address);

      expect(contractInfo.contractId).toBeDefined();
    });

    it('should schedule deployment of ERC20', async () => {
      const params = {
        tokenName: `ScheduledERC20-${new Date().getTime().toString()}`, // unique name to work around IDENTICAL_SCHEDULE_ALREADY_CREATED error
        tokenSymbol: 'TERC',
        schedulingParams: {
          isScheduled: true,
        },
      };

      const tool = createERC20Tool(context);
      const result: any = await tool.execute(executorClient, context, params);

      expect(result.humanMessage).toContain('Scheduled creation of ERC20 successfully.');
      expect(result.raw.scheduleId).toBeDefined();
    });
  });

  describe('Invalid Create ERC20 Scenarios', () => {
    it('should fail when required params are missing', async () => {
      const params: any = {}; // no tokenName, tokenSymbol

      const tool = createERC20Tool(context);
      const result: any = await tool.execute(executorClient, context, params);

      expect(result.humanMessage).toContain(
        'Invalid parameters: Field "tokenName" - Required; Field "tokenSymbol" - Required',
      );
      expect(result.raw.error).toContain(
        'Invalid parameters: Field "tokenName" - Required; Field "tokenSymbol" - Required',
      );
      expect(result.raw.error).toContain('Failed to create ERC20 token');
      expect(result.humanMessage).toContain('Failed to create ERC20 token');
    });

    it('should fail when decimals is invalid', async () => {
      const params: z.infer<ReturnType<typeof createERC20Parameters>> = {
        tokenName: 'BadDecimals',
        tokenSymbol: 'BD',
        decimals: -5,
        initialSupply: 0,
      };

      const tool = createERC20Tool(context);
      const result: any = await tool.execute(executorClient, context, params);

      expect(result.raw.error).toContain('Failed to create ERC20 token');
      expect(result.humanMessage).toContain('Failed to create ERC20 token');

      expect(result.raw.error).toContain(
        'Invalid parameters: Field "decimals" - Number must be greater than or equal to 0',
      );
      expect(result.humanMessage).toContain(
        'Invalid parameters: Field "decimals" - Number must be greater than or equal to 0',
      );
    });
  });
});
