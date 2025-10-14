import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client, PrivateKey } from '@hashgraph/sdk';
import { z } from 'zod';
import mintERC721Tool from '@/plugins/core-evm-plugin/tools/erc721/mint-erc721';
import createERC721Tool from '@/plugins/core-evm-plugin/tools/erc721/create-erc721';
import { Context, AgentMode } from '@/shared/configuration';
import { getCustomClient, getOperatorClientForTests, HederaOperationsWrapper } from '../../utils';
import { mintERC721Parameters, createERC721Parameters } from '@/shared/parameter-schemas/evm.zod';
import { wait } from '../../utils/general-util';
import { MIRROR_NODE_WAITING_TIME } from '../../utils/test-constants';
import { returnHbarsAndDeleteAccount } from '../../utils/teardown/account-teardown';

describe('Mint ERC721 Integration Tests', () => {
  let operatorClient: Client;
  let executorClient: Client;
  let context: Context;
  let operatorWrapper: HederaOperationsWrapper;
  let executorWrapper: HederaOperationsWrapper;
  let testTokenAddress: string;

  beforeAll(async () => {
    operatorClient = getOperatorClientForTests();
    operatorWrapper = new HederaOperationsWrapper(operatorClient);

    const executorAccountKey = PrivateKey.generateED25519();
    const executorAccountId = await operatorWrapper
      .createAccount({
        initialBalance: 30, // For creating tokens and minting
        key: executorAccountKey.publicKey,
        maxAutomaticTokenAssociations: -1,
      })
      .then(resp => resp.accountId!);
    executorClient = getCustomClient(executorAccountId, executorAccountKey);
    executorWrapper = new HederaOperationsWrapper(executorClient);

    context = {
      mode: AgentMode.AUTONOMOUS,
      accountId: executorAccountId.toString(),
    };

    // Create a test ERC721 token
    const createParams: z.infer<ReturnType<typeof createERC721Parameters>> = {
      tokenName: 'TestMintNFT',
      tokenSymbol: 'TMNFT',
      baseURI: 'https://example.com/metadata/',
    };

    const createTool = createERC721Tool(context);
    const createResult: any = await createTool.execute(executorClient, context, createParams);

    if (!createResult.erc721Address) {
      throw new Error('Failed to create test ERC721 token');
    }

    testTokenAddress = createResult.erc721Address;
    await wait(MIRROR_NODE_WAITING_TIME);
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

  describe('Valid Mint ERC721 Scenarios', () => {
    it('should mint token to a Hedera address', async () => {
      const params: z.infer<ReturnType<typeof mintERC721Parameters>> = {
        contractId: testTokenAddress,
        toAddress: executorClient.operatorAccountId!.toString(),
      };

      const tool = mintERC721Tool(context);
      const result: any = await tool.execute(executorClient, context, params);

      expect(result.raw.status.toString()).toBe('SUCCESS');
      expect(result.raw.transactionId).toBeDefined();
    });

    it('should mint token to an EVM address', async () => {
      const recipientInfo = await executorWrapper.getAccountInfo(
        operatorClient.operatorAccountId!.toString(),
      );
      const recipientEvmAddress = recipientInfo.contractAccountId!;

      const params: z.infer<ReturnType<typeof mintERC721Parameters>> = {
        contractId: testTokenAddress,
        toAddress: recipientEvmAddress,
      };

      const tool = mintERC721Tool(context);
      const result: any = await tool.execute(executorClient, context, params);

      expect(result.raw.status.toString()).toBe('SUCCESS');
      expect(result.raw.transactionId).toBeDefined();
    });

    it('should mint token to default (context) address when toAddress missing', async () => {
      const params: z.infer<ReturnType<typeof mintERC721Parameters>> = {
        contractId: testTokenAddress,
      };

      const tool = mintERC721Tool(context);
      const result: any = await tool.execute(executorClient, context, params);

      expect(result.raw.status.toString()).toBe('SUCCESS');
      expect(result.raw.transactionId).toBeDefined();
    });

    it('should schedule minting a token to a Hedera address', async () => {
      const params: z.infer<ReturnType<typeof mintERC721Parameters>> = {
        contractId: testTokenAddress,
        toAddress: executorClient.operatorAccountId!.toString(),
        schedulingParams: {
          isScheduled: true,
          adminKey: false,
          waitForExpiry: false,
        },
      };

      const tool = mintERC721Tool(context);
      const result: any = await tool.execute(executorClient, context, params);

      expect(result.humanMessage).toContain('Scheduled minting of ERC721 successfully.');
      expect(result.raw.scheduleId).toBeDefined();
    });
  });

  describe('Invalid Mint ERC721 Scenarios', () => {
    it('should fail when required params are missing', async () => {
      const params: any = {}; // no contractId

      const tool = mintERC721Tool(context);
      const result: any = await tool.execute(executorClient, context, params);

      expect(result.humanMessage).toContain('Failed to mint ERC721');
      expect(result.raw.error).toContain('Invalid parameters');
    });

    it('should fail when contractId is invalid', async () => {
      const params: any = {
        contractId: 'invalid-contract-id',
      };

      const tool = mintERC721Tool(context);
      const result: any = await tool.execute(executorClient, context, params);

      expect(result.humanMessage).toContain('Failed to mint ERC721');
      expect(result.raw.error).toContain('Failed to mint ERC721');
    });
  });
});
