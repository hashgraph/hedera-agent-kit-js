import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import { ReactAgent } from 'langchain';
import { createLangchainTestSetup, type LangchainTestSetup } from '@tests/utils';
import {
  getProfile,
  HederaOperationsWrapper,
  type TestAccount,
  waitForMirrorTx,
  itWithRetry,
} from '@hashgraph/hedera-agent-kit-tests';
import { ResponseParserService } from '@hashgraph/hedera-agent-kit-langchain';
import { Client } from '@hiero-ledger/sdk';

describe('Mint ERC721 Token E2E Tests', () => {
  const profile = getProfile();
  let testSetup: LangchainTestSetup;
  let agent: ReactAgent;
  let responseParsingService: ResponseParserService;
  let executor: TestAccount;
  let executorClient: Client;
  let executorWrapper: HederaOperationsWrapper;
  let recipient: TestAccount;
  let testTokenAddress: string;
  let recipientAccountId: string;

  beforeAll(async () => {
    executor = await profile.accounts.acquire({ tier: 'STANDARD' });
    ({ client: executorClient, wrapper: executorWrapper } = profile.client.connectAs(executor));

    recipient = await profile.accounts.acquire({ tier: 'MINIMAL' });
    recipientAccountId = recipient.accountId.toString();

    // Start LangChain test setup with an executor account
    testSetup = await createLangchainTestSetup(undefined, undefined, executorClient);
    agent = testSetup.agent;
    responseParsingService = testSetup.responseParser;

    // Create a test ERC721 token
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
    await waitForMirrorTx(executorWrapper, createParsedResponse[0].parsedData.raw.transactionId);
  });

  afterAll(async () => {
    await profile.accounts.release(recipient);
    await profile.accounts.release(executor);
    testSetup?.cleanup();
    executorClient?.close();
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
