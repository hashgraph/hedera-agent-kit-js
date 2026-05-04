import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client, TokenType, TokenSupplyType } from '@hiero-ledger/sdk';
import { createLangchainTestSetup, LangchainTestSetup } from '@tests/utils';
import {
  getProfile,
  HederaOperationsWrapper,
  type TestAccount,
  wait,
  MIRROR_NODE_WAITING_TIME,
} from '@hashgraph/hedera-agent-kit-tests';
import { ResponseParserService } from '@hashgraph/hedera-agent-kit-langchain';
import { ReactAgent } from 'langchain';

describe('Transfer NFT E2E Tests', () => {
  const profile = getProfile();
  let testSetup: LangchainTestSetup;
  let agent: ReactAgent;
  let responseParsingService: ResponseParserService;

  let owner: TestAccount;
  let ownerClient: Client;
  let ownerWrapper: HederaOperationsWrapper;

  let recipient: TestAccount;
  let recipientClient: Client;
  let recipientWrapper: HederaOperationsWrapper;

  let nftTokenId: string;

  beforeAll(async () => {
    // Create an owner (treasury) account
    owner = await profile.accounts.acquire({ tier: 'ELEVATED' });
    ({ client: ownerClient, wrapper: ownerWrapper } = profile.client.connectAs(owner));

    // Create a recipient account
    recipient = await profile.accounts.acquire({ tier: 'STANDARD' });
    ({ client: recipientClient, wrapper: recipientWrapper } = profile.client.connectAs(recipient));

    // Set up LangChain executor with an owner as an operator
    testSetup = await createLangchainTestSetup(undefined, undefined, ownerClient);
    agent = testSetup.agent;
    responseParsingService = testSetup.responseParser;

    // Create NFT token
    const tokenCreate = await ownerWrapper.createNonFungibleToken({
      tokenName: 'E2E-NFT',
      tokenSymbol: 'ENFT',
      tokenMemo: 'E2E transfer test',
      tokenType: TokenType.NonFungibleUnique,
      supplyType: TokenSupplyType.Finite,
      maxSupply: 10,
      treasuryAccountId: owner.accountId.toString(),
      adminKey: owner.privateKey.publicKey,
      supplyKey: owner.privateKey.publicKey,
      autoRenewAccountId: owner.accountId.toString(),
    });
    nftTokenId = tokenCreate.tokenId!.toString();

    // Mint NFTs via wrapper (mint 4 for the tests)
    await ownerWrapper.mintNft({
      tokenId: nftTokenId,
      metadata: [
        new TextEncoder().encode('ipfs://meta-1.json'),
        new TextEncoder().encode('ipfs://meta-2.json'),
        new TextEncoder().encode('ipfs://meta-3.json'),
        new TextEncoder().encode('ipfs://meta-4.json'),
      ],
    });

    // Associate recipient with the token (signed by recipient's wrapper)
    await recipientWrapper.associateToken({
      accountId: recipient.accountId.toString(),
      tokenId: nftTokenId,
    });
  });

  afterAll(async () => {
    await profile.accounts.release(recipient);
    await profile.accounts.release(owner);
    testSetup?.cleanup();
    ownerClient?.close();
    recipientClient?.close();
  });

  it('should transfer NFT to recipient via natural language', async () => {
    const input = `Transfer NFT ${nftTokenId} serial 1 to ${recipient.accountId.toString()}`;

    const transferResult = await agent.invoke({
      messages: [
        {
          role: 'user',
          content: input,
        },
      ],
    });

    const parsedResponse = responseParsingService.parseNewToolMessages(transferResult);

    expect(parsedResponse[0].parsedData.raw.status).toBe('SUCCESS');
    expect(parsedResponse[0].parsedData.humanMessage).toContain(
      'Non-fungible tokens successfully transferred. Transaction ID:',
    );

    // Wait for mirror node update
    await wait(MIRROR_NODE_WAITING_TIME);

    const recipientNfts = await ownerWrapper.getAccountNfts(recipient.accountId.toString());
    expect(
      recipientNfts.nfts.find(nft => nft.token_id === nftTokenId && nft.serial_number === 1),
    ).toBeTruthy();
  });

  it('should transfer multiple NFTs to recipient via natural language', async () => {
    const input = `Transfer NFT ${nftTokenId} serial 2 and serial 3 to ${recipient.accountId.toString()}`;

    const transferResult = await agent.invoke({
      messages: [
        {
          role: 'user',
          content: input,
        },
      ],
    });

    const parsedResponse = responseParsingService.parseNewToolMessages(transferResult);

    expect(parsedResponse[0].parsedData.raw.status).toBe('SUCCESS');
    expect(parsedResponse[0].parsedData.humanMessage).toContain(
      'Non-fungible tokens successfully transferred. Transaction ID:',
    );

    // Wait for mirror node update
    await wait(MIRROR_NODE_WAITING_TIME);

    const recipientNfts = await ownerWrapper.getAccountNfts(recipient.accountId.toString());
    expect(
      recipientNfts.nfts.find(nft => nft.token_id === nftTokenId && nft.serial_number === 2),
    ).toBeTruthy();
    expect(
      recipientNfts.nfts.find(nft => nft.token_id === nftTokenId && nft.serial_number === 3),
    ).toBeTruthy();
  });

  it('should schedule an NFT transfer via natural language', async () => {
    const input = `Schedule a transfer of HTS NFT with token ID: ${nftTokenId}, serial: 4 to account ${recipient.accountId.toString()}`;

    const transferResult = await agent.invoke({
      messages: [
        {
          role: 'user',
          content: input,
        },
      ],
    });

    const parsedResponse = responseParsingService.parseNewToolMessages(transferResult);

    expect(parsedResponse[0].parsedData.raw.status).toBe('SUCCESS');
    expect(parsedResponse[0].parsedData.humanMessage).toContain(
      'Scheduled non-fungible token transfer created successfully',
    );
    expect(parsedResponse[0].parsedData.humanMessage).toContain('Schedule ID:');
  });
});
