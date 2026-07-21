import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from '@hiero-ledger/sdk';
import { z } from 'zod';
import createERC20Tool from '@/plugins/core-evm-plugin/tools/erc20/create-erc20';
import { AgentMode, type Context } from '@/shared/configuration';
import {
  getProfile,
  HederaOperationsWrapper,
  type TestAccount,
} from '@hashgraph/hedera-agent-kit-tests';
import { createERC20Parameters } from '@/shared/parameter-schemas/evm.zod';

describe('Create ERC20 Integration Tests', () => {
  const profile = getProfile();
  let executor: TestAccount;
  let executorClient: Client;
  let executorWrapper: HederaOperationsWrapper;
  let context: Context;

  beforeAll(async () => {
    executor = await profile.accounts.acquire({ tier: 'STANDARD' });
    ({ client: executorClient, wrapper: executorWrapper } = profile.client.connectAs(executor));

    context = {
      mode: AgentMode.AUTONOMOUS,
      accountId: executor.accountId.toString(),
    };
  });

  afterAll(async () => {
    await profile.accounts.release(executor);
    executorClient?.close();
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
      expect(result.raw.error).toContain('Failed to execute Create ERC20 Token');
      expect(result.humanMessage).toContain('Failed to execute Create ERC20 Token');
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

      expect(result.raw.error).toContain('Failed to execute Create ERC20 Token');
      expect(result.humanMessage).toContain('Failed to execute Create ERC20 Token');

      expect(result.raw.error).toContain(
        'Invalid parameters: Field "decimals" - Number must be greater than or equal to 0',
      );
      expect(result.humanMessage).toContain(
        'Invalid parameters: Field "decimals" - Number must be greater than or equal to 0',
      );
    });
  });
});
