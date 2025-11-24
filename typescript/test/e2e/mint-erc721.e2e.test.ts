import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import { ReactAgent } from 'langchain';
import {
  createLangchainTestSetup,
  HederaOperationsWrapper,
  type LangchainTestSetup,
  getOperatorClientForTests,
  getCustomClient,
} from '../utils';
import { ResponseParserService } from '@/langchain';
import { AccountId, Client, PrivateKey } from '@hashgraph/sdk';
import { wait } from '../utils/general-util';
import { returnHbarsAndDeleteAccount } from '../utils/teardown/account-teardown';
import { MIRROR_NODE_WAITING_TIME } from '../utils/test-constants';
import { itWithRetry } from '../utils/retry-util';

describe('Mint ERC721 Token E2E Tests', () => {
  let testSetup: LangchainTestSetup;
  let agent: ReactAgent;
  let responseParsingService: ResponseParserService;
  let executorClient: Client;
  let operatorClient: Client;
  let executorWrapper: HederaOperationsWrapper;
  let testTokenAddress: string;
  let recipientAccountId: string;

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

    // 2. Create a recipient account (with the same public key as the executor for simplicity)
    recipientAccountId = await operatorWrapper
      .createAccount({
        key: executorAccountKey.publicKey,
        initialBalance: 0,
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
    const createInput = 'Create an ERC721 token named MintTest with symbol MNT';
    const createResult = await agent.invoke({
      messages: [
        {
          role: 'user',
          content: createInput,
        },
      ],
    });
    const createParsedResponse = responseParsingService.parseNewToolMessages(createResult);

    if (!createParsedResponse[0].parsedData.raw.erc721Address) {
      throw new Error('Failed to create test ERC721 token for minting');
    }

    testTokenAddress = createParsedResponse[0].parsedData.raw.erc721Address;
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

  it(
    'mints ERC721 token to another account via natural language',
    itWithRetry(async () => {
      const input = `Mint ERC721 token form contract: ${testTokenAddress} to ${recipientAccountId}`;

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
      expect(parsedResponse[0].parsedData.raw.status).toBe('SUCCESS');
      expect(parsedResponse[0].parsedData.raw.transactionId).toBeDefined();
    }),
  );

  it(
    'mints token to default (context) account when toAddress missing',
    itWithRetry(async () => {
      const input = `Mint ERC721 token ${testTokenAddress}`;

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
      expect(parsedResponse[0].parsedData.raw.status).toBe('SUCCESS');
      expect(parsedResponse[0].parsedData.raw.transactionId).toBeDefined();
    }),
  );

  it.skip(
    'handles various natural language variations for minting',
    itWithRetry(async () => {
      const variations = [
        `Mint NFT (ERC-721) from ${testTokenAddress} to ${recipientAccountId}`,
        `Create EVM compatible NFT from contract ${testTokenAddress} to ${recipientAccountId}`,
        `Mint a token from ${testTokenAddress} (ERC721 contract) for ${recipientAccountId}`,
      ];

      for (const input of variations) {
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
        expect(parsedResponse[0].parsedData.raw.status).toBe('SUCCESS');
        expect(parsedResponse[0].parsedData.raw.transactionId).toBeDefined();
      }
    }),
  );

  it(
    'schedules minting ERC721 token to another account via natural language',
    itWithRetry(async () => {
      const input = `Mint ERC721 token from contract: ${testTokenAddress} to ${recipientAccountId}. Schedule this transaction.`;

      const result = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: input,
          },
        ],
      });
      const parsedResponse = responseParsingService.parseNewToolMessages(result);

      // Validate response structure
      expect(parsedResponse[0].parsedData.raw).toBeDefined();
      expect(parsedResponse[0].parsedData.raw.transactionId).toBeDefined();
      expect(parsedResponse[0].parsedData.raw.scheduleId).not.toBeNull();
      expect(parsedResponse[0].parsedData.humanMessage).toContain(
        'Scheduled minting of ERC721 successfully.',
      );
    }),
  );
});
