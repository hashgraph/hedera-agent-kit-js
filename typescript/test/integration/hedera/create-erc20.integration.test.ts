import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from '@hashgraph/sdk';
import { z } from 'zod';
import createERC20Tool from '@/plugins/core-evm-plugin/tools/erc20/create-erc20';
import { Context, AgentMode } from '@/shared/configuration';
import { getOperatorClientForTests, HederaOperationsWrapper } from '../../utils';
import { createERC20Parameters } from '@/shared/parameter-schemas/evm.zod';

describe('Create ERC20 Integration Tests', () => {
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

  describe('Valid Create ERC20 Scenarios', () => {
    it('should deploy an ERC20 contract with minimal params', async () => {
      const params = {
        tokenName: 'TestERC20',
        tokenSymbol: 'TERC',
      };

      const tool = createERC20Tool(context);
      const result: any = await tool.execute(client, context, params);

      expect(result.humanMessage).toContain('ERC20 token created successfully');
      expect(result.erc20Address).toMatch(/^0x[a-fA-F0-9]{40}$/);

      const contractInfo = await hederaOperationsWrapper.getContractInfo(result.erc20Address);

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
      const result: any = await tool.execute(client, context, params);

      expect(result.humanMessage).toContain('ERC20 token created successfully');
      expect(result.erc20Address).toMatch(/^0x[a-fA-F0-9]{40}$/);

      const contractInfo = await hederaOperationsWrapper.getContractInfo(result.erc20Address);

      expect(contractInfo.contractId).toBeDefined();
    });
  });

  describe('Invalid Create ERC20 Scenarios', () => {
    it('should fail when required params are missing', async () => {
      const params: any = {}; // no tokenName, tokenSymbol

      const tool = createERC20Tool(context);
      const result: any = await tool.execute(client, context, params);

      expect(result.humanMessage).toContain('Error creating ERC20 token');
      expect(result.raw.error).toContain('Error creating ERC20 token');
    });

    it('should fail when decimals is invalid', async () => {
      const params: z.infer<ReturnType<typeof createERC20Parameters>> = {
        tokenName: 'BadDecimals',
        tokenSymbol: 'BD',
        decimals: -5,
        initialSupply: 0,
      };

      const tool = createERC20Tool(context);
      const result: any = await tool.execute(client, context, params);

      expect(result.raw.error).toContain('Error creating ERC20 token');
    });
  });
});
