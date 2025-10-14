import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import { AgentExecutor } from 'langchain/agents';
import {
  createLangchainTestSetup,
  HederaOperationsWrapper,
  type LangchainTestSetup,
  getOperatorClientForTests,
  getCustomClient,
} from '../utils';
import { AccountId, Client, PrivateKey } from '@hashgraph/sdk';
import { extractObservationFromLangchainResponse, wait } from '../utils/general-util';
import { returnHbarsAndDeleteAccount } from '../utils/teardown/account-teardown';
import { MIRROR_NODE_WAITING_TIME } from '../utils/test-constants';
import { createERC721Parameters } from '@/shared/parameter-schemas/evm.zod';
import { z } from 'zod';
import { itWithRetry } from '../utils/retry-util';

describe('Transfer ERC721 Token E2E Tests', () => {
  let testSetup: LangchainTestSetup;
  let agentExecutor: AgentExecutor;
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
        initialBalance: 20,
        maxAutomaticTokenAssociations: -1,
      })
      .then(resp => resp.accountId!);

    // 2. Create a recipient account
    recipientAccountId = await operatorWrapper
      .createAccount({
        key: executorAccountKey.publicKey,
        initialBalance: 5,
        maxAutomaticTokenAssociations: -1,
      })
      .then(resp => resp.accountId!.toString());

    // 3. Build executor client
    executorClient = getCustomClient(executorAccountId, executorAccountKey);

    // 4. Start LangChain test setup with an executor account
    testSetup = await createLangchainTestSetup(undefined, undefined, executorClient);
    agentExecutor = testSetup.agentExecutor;
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

      const result = await agentExecutor.invoke({ input });
      const observation = extractObservationFromLangchainResponse(result);

      expect(observation).toBeDefined();
      expect(observation.raw.status.toString()).toBe('SUCCESS');
      expect(observation.raw.transactionId).toBeDefined();
    }),
  );

  it(
    'transfers token with explicit from address',
    itWithRetry(async () => {
      const tokenId = await mintTokenForTransfer();
      nextTokenId = tokenId + 1;
      const input = `Transfer erc721 ${tokenId} of contract ${testTokenAddress} to address ${recipientAccountId}`;

      const result = await agentExecutor.invoke({ input });
      const observation = extractObservationFromLangchainResponse(result);

      expect(observation).toBeDefined();
      expect(observation.raw.status.toString()).toBe('SUCCESS');
      expect(observation.raw.transactionId).toBeDefined();
    }),
  );

  it(
    'schedules transfer of ERC721 token to another account via natural language',
    itWithRetry(async () => {
      const tokenId = await mintTokenForTransfer();
      nextTokenId = tokenId + 1;
      const input = `Transfer ERC721 token ${testTokenAddress} with id ${tokenId} from ${executorClient.operatorAccountId!.toString()} to ${recipientAccountId}. Schedule this transaction.`;

      const result = await agentExecutor.invoke({ input });
      const observation = extractObservationFromLangchainResponse(result);

      expect(observation.raw).toBeDefined();
      expect(observation.raw.transactionId).toBeDefined();
      expect(observation.raw.scheduleId).not.toBeNull();
      expect(observation.humanMessage).toContain('Scheduled transfer of ERC721 successfully.');
    }),
  );

  it(
    'fails gracefully with non-existent token ID',
    itWithRetry(async () => {
      const input = `Transfer ERC721 token 999999 from ${testTokenAddress} to ${recipientAccountId}`;

      const result = await agentExecutor.invoke({ input });
      const observation = extractObservationFromLangchainResponse(result);

      expect(observation).toBeDefined();
      expect(observation.humanMessage).toContain('Failed to transfer ERC721');
    }),
  );
});
