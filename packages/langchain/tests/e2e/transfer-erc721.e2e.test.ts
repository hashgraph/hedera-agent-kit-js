import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import { ReactAgent } from 'langchain';
import { createLangchainTestSetup, type LangchainTestSetup } from '@tests/utils';
import {
  getProfile,
  HederaOperationsWrapper,
  type TestAccount,
  waitForMirrorTx,
} from '@hashgraph/hedera-agent-kit-tests';
import { ResponseParserService } from '@hashgraph/hedera-agent-kit-langchain';
import { Client } from '@hiero-ledger/sdk';
import { createERC721Parameters } from '@hashgraph/hedera-agent-kit';
import { z } from 'zod';

describe('Transfer ERC721 Token E2E Tests', () => {
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
  let nextTokenId: number = 0;

  beforeAll(async () => {
    executor = await profile.accounts.acquire({ tier: 'STANDARD' });
    ({ client: executorClient, wrapper: executorWrapper } = profile.client.connectAs(executor));

    recipient = await profile.accounts.acquire({ tier: 'MINIMAL' });
    recipientAccountId = recipient.accountId.toString();

    // 4. Start LangChain test setup with an executor account
    testSetup = await createLangchainTestSetup(undefined, undefined, executorClient);
    agent = testSetup.agent;
    responseParsingService = testSetup.responseParser;

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

    await waitForMirrorTx(executorWrapper, createResult.raw.transactionId);
  });

  afterAll(async () => {
    await profile.accounts.release(recipient);
    await profile.accounts.release(executor);
    testSetup?.cleanup();
    executorClient?.close();
  });

  const mintTokenForTransfer = async (): Promise<number> => {
    const mintResp = await executorWrapper.mintERC721({
      contractId: testTokenAddress,
      toAddress: executor.accountId.toString(),
    });
    await waitForMirrorTx(executorWrapper, mintResp.raw.transactionId);
    return nextTokenId;
  };

  it(
    'transfers ERC721 token to another account via natural language',
    async () => {
      const tokenId = await mintTokenForTransfer();
      nextTokenId = tokenId + 1;
      const input = `Transfer ERC721 token ${testTokenAddress} with id ${tokenId} from ${executor.accountId.toString()} to ${recipientAccountId}`;

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
    },
  );

  it(
    'transfers token with explicit from address',
    async () => {
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
    },
  );

  it(
    'schedules transfer of ERC721 token to another account via natural language',
    async () => {
      const tokenId = await mintTokenForTransfer();
      nextTokenId = tokenId + 1;
      const input = `Transfer ERC721 token ${testTokenAddress} with id ${tokenId} from ${executor.accountId.toString()} to ${recipientAccountId}. Schedule this transaction.`;

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
    },
  );

  it(
    'fails gracefully with non-existent token ID',
    async () => {
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
    },
  );
});
