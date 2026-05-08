import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  Client,
  TokenId,
  TokenType,
  TokenSupplyType,
  TokenNftAllowance,
  Long,
} from '@hiero-ledger/sdk';
import { createLangchainTestSetup, LangchainTestSetup } from '@tests/utils';
import {
  getProfile,
  HederaOperationsWrapper,
  type TestAccount,
  waitForMirrorTx,
} from '@hashgraph/hedera-agent-kit-tests';
import { ResponseParserService } from '@hashgraph/hedera-agent-kit-langchain';
import { ReactAgent } from 'langchain';

describe('Transfer NFT With Allowance E2E Tests', () => {
  const profile = getProfile();
  let testSetup: LangchainTestSetup;
  let agent: ReactAgent;
  let responseParsingService: ResponseParserService;

  let owner: TestAccount;
  let ownerClient: Client;
  let ownerWrapper: HederaOperationsWrapper;

  let spender: TestAccount;
  let spenderClient: Client;
  let spenderWrapper: HederaOperationsWrapper;

  let nftTokenId: string;

  beforeAll(async () => {
    // Create a treasury (owner) account
    owner = await profile.accounts.acquire({ tier: 'ELEVATED' });
    ({ client: ownerClient, wrapper: ownerWrapper } = profile.client.connectAs(owner));

    // Create a spender account
    spender = await profile.accounts.acquire({ tier: 'STANDARD' });
    ({ client: spenderClient, wrapper: spenderWrapper } = profile.client.connectAs(spender));

    // Set up LangChain executor with spender (who uses allowance)
    testSetup = await createLangchainTestSetup(undefined, undefined, spenderClient);
    agent = testSetup.agent;
    responseParsingService = testSetup.responseParser;

    // Create NFT token
    const tokenCreate = await ownerWrapper.createNonFungibleToken({
      tokenName: 'E2E-NFT',
      tokenSymbol: 'ENFT',
      tokenMemo: 'E2E allowance integration',
      tokenType: TokenType.NonFungibleUnique,
      supplyType: TokenSupplyType.Finite,
      maxSupply: 10,
      treasuryAccountId: owner.accountId.toString(),
      adminKey: owner.privateKey.publicKey,
      supplyKey: owner.privateKey.publicKey,
      autoRenewAccountId: owner.accountId.toString(),
    });
    nftTokenId = tokenCreate.tokenId!.toString();

    // Mint NFTs via wrapper
    await ownerWrapper.mintNft({
      tokenId: nftTokenId,
      metadata: [new TextEncoder().encode('ipfs://meta-1.json')],
    });

    // Associate spender with the token (must be signed by spender)
    await spenderWrapper.associateToken({
      accountId: spender.accountId.toString(),
      tokenId: nftTokenId,
    });
  });

  beforeEach(async () => {
    // Approve NFT allowance for the spender before each test
    await ownerWrapper.approveNftAllowance({
      nftApprovals: [
        new TokenNftAllowance({
          tokenId: TokenId.fromString(nftTokenId),
          ownerAccountId: owner.accountId,
          spenderAccountId: spender.accountId,
          serialNumbers: [Long.fromNumber(1)],
          allSerials: false,
          delegatingSpender: null,
        }),
      ],
      transactionMemo: 'Approve NFT allowance',
    });
  });

  afterAll(async () => {
    await profile.accounts.release(spender);
    await profile.accounts.release(owner);
    testSetup?.cleanup();
    ownerClient?.close();
    spenderClient?.close();
  });

  it('should transfer NFT via allowance to recipient', async () => {
    const input = `Transfer NFT with allowance from ${owner.accountId.toString()} to ${spender.accountId.toString()} with serial number 1 of ${nftTokenId}`;

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
      'Non-fungible tokens successfully transferred with allowance. Transaction ID:',
    );

    // Wait for mirror node update
    await waitForMirrorTx(ownerWrapper, parsedResponse[0].parsedData.raw.transactionId);

    const recipientNfts = await ownerWrapper.getAccountNfts(spender.accountId.toString());
    expect(
      recipientNfts.nfts.find(nft => nft.token_id === nftTokenId && nft.serial_number === 1),
    ).toBeTruthy();
  });
});
