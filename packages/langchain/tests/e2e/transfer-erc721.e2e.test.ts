import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import { ReactAgent } from 'langchain';
import {
  getOperatorClientForTests,
  getCustomClient,
} from '@hashgraph/hedera-agent-kit-tests/shared/setup/client-setup';
import { createLangchainTestSetup, type LangchainTestSetup } from '@tests/utils';
import HederaOperationsWrapper from '@hashgraph/hedera-agent-kit-tests/shared/hedera-operations/HederaOperationsWrapper';
import { ResponseParserService } from '@hashgraph/hedera-agent-kit-langchain';
import { AccountId, Client, PrivateKey } from '@hashgraph/sdk';
import { wait } from '@hashgraph/hedera-agent-kit-tests/shared/general-util';
import { returnHbarsAndDeleteAccount } from '@hashgraph/hedera-agent-kit-tests/shared/teardown/account-teardown';
import { MIRROR_NODE_WAITING_TIME } from '@hashgraph/hedera-agent-kit-tests/shared/test-constants';
import { createERC721Parameters } from '@hashgraph/hedera-agent-kit';
import { z } from 'zod';
import { itWithRetry } from '@hashgraph/hedera-agent-kit-tests/shared/retry-util';
import { UsdToHbarService } from '@hashgraph/hedera-agent-kit-tests/shared/usd-to-hbar-service';
import { BALANCE_TIERS } from '@tests/utils';

describe('Transfer ERC721 Token E2E Tests', () => {
  let testSetup: LangchainTestSetup;
  let agent: ReactAgent;
  let responseParsingService: ResponseParserService;
  let executorClient: Client;
  let operatorClient: Client;
  let executorWrapper: HederaOperationsWrapper;
  let testTokenAddress: string;
  let recipientAccountId: string;
  let nextTokenId: number = 0;

  beforeAll(async () => {
    operatorClient = getOperatorClientForTests();
    const operatorWrapper = new HederaOperationsWrapper(operatorClient);

    // 1. Create an executor account (funded by operator)
    const executorAccountKey = PrivateKey.generateED25519();
    const executorAccountId = await operatorWrapper
      .createAccount({
        key: executorAccountKey.publicKey,
        initialBalance: UsdToHbarService.usdToHbar(BALANCE_TIERS.STANDARD),
        maxAutomaticTokenAssociations: -1,
      })
      .then(resp => resp.accountId!);

    // 2. Create a recipient account
    recipientAccountId = await operatorWrapper
      .createAccount({
        key: executorAccountKey.publicKey,
        initialBalance: UsdToHbarService.usdToHbar(0.6),
        maxAutomaticTokenAssociations: -1,
      })
      .then(resp => resp.accountId!.toString());

    // 3. Build executor client
    executorClient = getCustomClient(executorAccountId, executorAccountKey);

    // 4. Start LangChain test setup with an executor account
    testSetup = await createLangchainTestSetup(undefined, undefined, executorClient);
    agent = testSetup.agent;
    responseParsingService = testSetup.responseParser;
    executorWrapper = new HederaOperationsWrapper(executorClient);

    await wait(MIRROR_NODE_WAITING_TIME);

    // 5. Create a test ERC721 token
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
      toAddress: executorClient.operatorAccountId!.toString(),
    });
    await wait(MIRROR_NODE_WAITING_TIME);
    return nextTokenId;
  };

  it(
    'transfers ERC721 token to another account via natural language',
    itWithRetry(async () => {
      const tokenId = await mintTokenForTransfer();
      nextTokenId = tokenId + 1;
      const input = `Transfer ERC721 token ${testTokenAddress} with id ${tokenId} from ${executorClient.operatorAccountId!.toString()} to ${recipientAccountId}`;

      const result = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: input,
          },
        ],
      });
      const parsedResponse = responseParsingService.parseNewToolMessages(result);

      expect(parsedResponse).toBeDefined();
      expect(parsedResponse[0].parsedData.raw.status.toString()).toBe('SUCCESS');
      expect(parsedResponse[0].parsedData.raw.transactionId).toBeDefined();
    }),
  );

  it(
    'transfers token with explicit from address',
    itWithRetry(async () => {
      const tokenId = await mintTokenForTransfer();
      nextTokenId = tokenId + 1;
      const input = `Transfer erc721 ${tokenId} of contract ${testTokenAddress} to address ${recipientAccountId}`;

      const result = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: input,
          },
        ],
      });
      const parsedResponse = responseParsingService.parseNewToolMessages(result);

      expect(parsedResponse).toBeDefined();
      expect(parsedResponse[0].parsedData.raw.status.toString()).toBe('SUCCESS');
      expect(parsedResponse[0].parsedData.raw.transactionId).toBeDefined();
    }),
  );

  it(
    'schedules transfer of ERC721 token to another account via natural language',
    itWithRetry(async () => {
      const tokenId = await mintTokenForTransfer();
      nextTokenId = tokenId + 1;
      const input = `Transfer ERC721 token ${testTokenAddress} with id ${tokenId} from ${executorClient.operatorAccountId!.toString()} to ${recipientAccountId}. Schedule this transaction.`;

      const result = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: input,
          },
        ],
      });
      const parsedResponse = responseParsingService.parseNewToolMessages(result);

      expect(parsedResponse[0].parsedData.raw).toBeDefined();
      expect(parsedResponse[0].parsedData.raw.transactionId).toBeDefined();
      expect(parsedResponse[0].parsedData.raw.scheduleId).not.toBeNull();
      expect(parsedResponse[0].parsedData.humanMessage).toContain(
        'Scheduled transfer of ERC721 successfully.',
      );
    }),
  );

  it(
    'fails gracefully with non-existent token ID',
    itWithRetry(async () => {
      const input = `Transfer ERC721 token 999999 from ${testTokenAddress} to ${recipientAccountId}`;

      const result = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: input,
          },
        ],
      });
      const parsedResponse = responseParsingService.parseNewToolMessages(result);

      expect(parsedResponse).toBeDefined();
      expect(parsedResponse[0].parsedData.humanMessage).toContain('Failed to transfer ERC721');
    }),
  );
});
