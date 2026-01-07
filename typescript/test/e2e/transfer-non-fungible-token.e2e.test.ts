import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AccountId, Client, PrivateKey, TokenType, TokenSupplyType } from '@hashgraph/sdk';
import {
  createLangchainTestSetup,
  getCustomClient,
  getOperatorClientForTests,
  HederaOperationsWrapper,
  LangchainTestSetup,
} from '../utils';
import { ResponseParserService } from '@/langchain';
import { returnHbarsAndDeleteAccount } from '../utils/teardown/account-teardown';
import { wait } from '../utils/general-util';
import { MIRROR_NODE_WAITING_TIME } from '../utils/test-constants';
import { ReactAgent } from 'langchain';
import { UsdToHbarService } from '../utils/usd-to-hbar-service';
import { BALANCE_TIERS } from '../utils/setup/langchain-test-config';

describe('Transfer NFT E2E Tests', () => {
  let testSetup: LangchainTestSetup;
  let agent: ReactAgent;
  let responseParsingService: ResponseParserService;
  let operatorClient: Client;
  let ownerClient: Client;
  let recipientClient: Client;
  let ownerWrapper: HederaOperationsWrapper;
  let operatorWrapper: HederaOperationsWrapper;
  let recipientWrapper: HederaOperationsWrapper;
  let ownerAccountId: AccountId;
  let recipientAccountId: AccountId;
  let nftTokenId: string;

  beforeAll(async () => {
    operatorClient = getOperatorClientForTests();
    operatorWrapper = new HederaOperationsWrapper(operatorClient);

    // Create an owner (treasury) account
    const ownerKey = PrivateKey.generateED25519();
    ownerAccountId = await operatorWrapper
      .createAccount({
        initialBalance: UsdToHbarService.usdToHbar(BALANCE_TIERS.ELEVATED),
        key: ownerKey.publicKey,
      })
      .then(resp => resp.accountId!);
    ownerClient = getCustomClient(ownerAccountId, ownerKey);
    ownerWrapper = new HederaOperationsWrapper(ownerClient);

    // Create a recipient account
    const recipientKey = PrivateKey.generateED25519();
    recipientAccountId = await operatorWrapper
      .createAccount({
        initialBalance: UsdToHbarService.usdToHbar(BALANCE_TIERS.STANDARD),
        key: recipientKey.publicKey,
      })
      .then(resp => resp.accountId!);
    recipientClient = getCustomClient(recipientAccountId, recipientKey);
    recipientWrapper = new HederaOperationsWrapper(recipientClient);

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
      treasuryAccountId: ownerAccountId.toString(),
      adminKey: ownerClient.operatorPublicKey!,
      supplyKey: ownerClient.operatorPublicKey!,
      autoRenewAccountId: ownerAccountId.toString(),
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

    // Associate recipient with the token
    await recipientWrapper.associateToken({
      accountId: recipientAccountId.toString(),
      tokenId: nftTokenId,
    });
  });

  afterAll(async () => {
    try {
      await returnHbarsAndDeleteAccount(
        ownerWrapper,
        recipientAccountId,
        operatorClient.operatorAccountId!,
      );
      await returnHbarsAndDeleteAccount(
        ownerWrapper,
        ownerAccountId,
        operatorClient.operatorAccountId!,
      );
    } catch (err) {
      console.warn('Cleanup failed:', err);
    }

    ownerClient?.close();
    recipientClient?.close();
    operatorClient?.close();
  });

  it('should transfer NFT to recipient via natural language', async () => {
    const input = `Transfer NFT ${nftTokenId} serial 1 to ${recipientAccountId.toString()}`;

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

    const recipientNfts = await ownerWrapper.getAccountNfts(recipientAccountId.toString());
    expect(
      recipientNfts.nfts.find(nft => nft.token_id === nftTokenId && nft.serial_number === 1),
    ).toBeTruthy();
  });

  it('should transfer multiple NFTs to recipient via natural language', async () => {
    const input = `Transfer NFT ${nftTokenId} serial 2 and serial 3 to ${recipientAccountId.toString()}`;

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

    const recipientNfts = await ownerWrapper.getAccountNfts(recipientAccountId.toString());
    expect(
      recipientNfts.nfts.find(nft => nft.token_id === nftTokenId && nft.serial_number === 2),
    ).toBeTruthy();
    expect(
      recipientNfts.nfts.find(nft => nft.token_id === nftTokenId && nft.serial_number === 3),
    ).toBeTruthy();
  });

  it('should schedule an NFT transfer via natural language', async () => {
    const input = `Schedule a transfer of NFT ${nftTokenId} serial 4 to ${recipientAccountId.toString()}`;

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
