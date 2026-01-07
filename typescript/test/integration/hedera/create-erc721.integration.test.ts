import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AccountId, Client, PrivateKey } from '@hashgraph/sdk';
import { z } from 'zod';
import createERC721Tool from '@/plugins/core-evm-plugin/tools/erc721/create-erc721';
import { Context, AgentMode } from '@/shared/configuration';
import { getCustomClient, getOperatorClientForTests, HederaOperationsWrapper } from '../../utils';
import { createERC721Parameters } from '@/shared/parameter-schemas/evm.zod';
import { UsdToHbarService } from '../../utils/usd-to-hbar-service';
import { BALANCE_TIERS } from '../../utils/setup/langchain-test-config';
import { returnHbarsAndDeleteAccount } from '../../utils/teardown/account-teardown';

describe('Create ERC721 Integration Tests', () => {
  let operatorClient: Client;
  let executorClient: Client;
  let context: Context;
  let operatorWrapper: HederaOperationsWrapper;
  let executorWrapper: HederaOperationsWrapper;
  let executorAccountId: AccountId;

  beforeAll(async () => {
    operatorClient = getOperatorClientForTests();
    operatorWrapper = new HederaOperationsWrapper(operatorClient);

    const executorAccountKey = PrivateKey.generateED25519();
    executorAccountId = await operatorWrapper
      .createAccount({
        initialBalance: UsdToHbarService.usdToHbar(BALANCE_TIERS.STANDARD), // For creating NFTs
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
    if (executorClient && operatorClient) {
      await returnHbarsAndDeleteAccount(
        executorWrapper,
        executorAccountId,
        operatorClient.operatorAccountId!,
      );
      executorClient.close();
      operatorClient.close();
    }
  });

  describe('Valid Create ERC721 Scenarios', () => {
    it('should deploy an ERC721 contract with minimal params', async () => {
      const params = {
        tokenName: 'TestERC721',
        tokenSymbol: 'TNFT',
      };

      const tool = createERC721Tool(context);
      const result: any = await tool.execute(executorClient, context, params);

      expect(result.humanMessage).toContain('ERC721 token created successfully');
      expect(result.erc721Address).toMatch(/^0x[a-fA-F0-9]{40}$/);

      const contractInfo = await executorWrapper.getContractInfo(result.erc721Address);

      expect(contractInfo.contractId).toBeDefined();
      expect(contractInfo.adminKey).toBeDefined();
    });

    it('should deploy ERC721 with baseURI', async () => {
      const params: z.infer<ReturnType<typeof createERC721Parameters>> = {
        tokenName: 'ArtNFT',
        tokenSymbol: 'ART',
        baseURI: 'https://example.com/metadata/',
      };

      const tool = createERC721Tool(context);
      const result: any = await tool.execute(executorClient, context, params);

      expect(result.humanMessage).toContain('ERC721 token created successfully');
      expect(result.erc721Address).toMatch(/^0x[a-fA-F0-9]{40}$/);

      const contractInfo = await executorWrapper.getContractInfo(result.erc721Address);

      expect(contractInfo.contractId).toBeDefined();
    });

    it('should deploy ERC721 with empty baseURI', async () => {
      const params: z.infer<ReturnType<typeof createERC721Parameters>> = {
        tokenName: 'EmptyURINFT',
        tokenSymbol: 'EURI',
        baseURI: '',
      };

      const tool = createERC721Tool(context);
      const result: any = await tool.execute(executorClient, context, params);

      expect(result.humanMessage).toContain('ERC721 token created successfully');
      expect(result.erc721Address).toMatch(/^0x[a-fA-F0-9]{40}$/);

      const contractInfo = await executorWrapper.getContractInfo(result.erc721Address);

      expect(contractInfo.contractId).toBeDefined();
    });

    it('should schedule deployment of an ERC721 contract with minimal params', async () => {
      const params = {
        tokenName: `ScheduledERC721-${new Date().getTime().toString()}`, // unique name to work around IDENTICAL_SCHEDULE_ALREADY_CREATED error
        tokenSymbol: 'STNFT',
        schedulingParams: { isScheduled: true },
      };

      const tool = createERC721Tool(context);
      const result: any = await tool.execute(executorClient, context, params);

      expect(result.humanMessage).toContain('Scheduled creation of ERC721 successfully.');
      expect(result.raw.scheduleId).toBeDefined();
    });
  });

  describe('Invalid Create ERC721 Scenarios', () => {
    it('should fail when required params are missing', async () => {
      const params: any = {}; // no tokenName, tokenSymbol

      const tool = createERC721Tool(context);
      const result: any = await tool.execute(executorClient, context, params);

      expect(result.humanMessage).toContain(
        'Invalid parameters: Field "tokenName" - Required; Field "tokenSymbol" - Required',
      );
      expect(result.raw.error).toContain(
        'Invalid parameters: Field "tokenName" - Required; Field "tokenSymbol" - Required',
      );
      expect(result.raw.error).toContain('Failed to create ERC721 token');
      expect(result.humanMessage).toContain('Failed to create ERC721 token');
    });

    it('should fail when tokenName is invalid type', async () => {
      const params: any = {
        tokenName: 123, // invalid type
        tokenSymbol: 'TNFT',
        baseURI: 'https://example.com/',
      };

      const tool = createERC721Tool(context);
      const result: any = await tool.execute(executorClient, context, params);

      expect(result.raw.error).toContain('Failed to create ERC721 token');
      expect(result.humanMessage).toContain('Failed to create ERC721 token');

      expect(result.raw.error).toContain('Invalid parameters: Field "tokenName"');
      expect(result.humanMessage).toContain('Invalid parameters: Field "tokenName"');
    });

    it('should fail when baseURI is invalid type', async () => {
      const params: any = {
        tokenName: 'ValidName',
        tokenSymbol: 'VN',
        baseURI: 456, // invalid type
      };

      const tool = createERC721Tool(context);
      const result: any = await tool.execute(executorClient, context, params);

      expect(result.raw.error).toContain('Failed to create ERC721 token');
      expect(result.humanMessage).toContain('Failed to create ERC721 token');

      expect(result.raw.error).toContain('Invalid parameters: Field "baseURI"');
      expect(result.humanMessage).toContain('Invalid parameters: Field "baseURI"');
    });
  });
});
