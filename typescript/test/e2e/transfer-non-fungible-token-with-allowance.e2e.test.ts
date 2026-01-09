import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  AccountId,
  Client,
  PrivateKey,
  TokenId,
  TokenType,
  TokenSupplyType,
  TokenNftAllowance,
  Long,
} from '@hashgraph/sdk';
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

describe('Transfer NFT With Allowance E2E Tests', () => {
  let testSetup: LangchainTestSetup;
  let agent: ReactAgent;
  let responseParsingService: ResponseParserService;
  let operatorClient: Client;
  let ownerClient: Client;
  let spenderClient: Client;
  let ownerWrapper: HederaOperationsWrapper;
  let operatorWrapper: HederaOperationsWrapper;
  let spenderWrapper: HederaOperationsWrapper;
  let ownerAccountId: AccountId;
  let spenderAccountId: AccountId;
  let nftTokenId: string;

  beforeAll(async () => {
    operatorClient = getOperatorClientForTests();
    operatorWrapper = new HederaOperationsWrapper(operatorClient);

    // Create a treasury (owner) account
    const ownerKey = PrivateKey.generateED25519();
    ownerAccountId = await operatorWrapper
      .createAccount({
        initialBalance: UsdToHbarService.usdToHbar(BALANCE_TIERS.ELEVATED),
        key: ownerKey.publicKey,
      })
      .then(resp => resp.accountId!);
    ownerClient = getCustomClient(ownerAccountId, ownerKey);
    ownerWrapper = new HederaOperationsWrapper(ownerClient);

    // Create a spender account
    const spenderKey = PrivateKey.generateED25519();
    spenderAccountId = await operatorWrapper
      .createAccount({
        initialBalance: UsdToHbarService.usdToHbar(BALANCE_TIERS.STANDARD),
        key: spenderKey.publicKey,
      })
      .then(resp => resp.accountId!);
    spenderClient = getCustomClient(spenderAccountId, spenderKey);
    spenderWrapper = new HederaOperationsWrapper(spenderClient);

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
      treasuryAccountId: ownerAccountId.toString(),
      adminKey: ownerClient.operatorPublicKey!,
      supplyKey: ownerClient.operatorPublicKey!,
      autoRenewAccountId: ownerAccountId.toString(),
    });
    nftTokenId = tokenCreate.tokenId!.toString();

    // Mint NFTs via wrapper
    await ownerWrapper.mintNft({
      tokenId: nftTokenId,
      metadata: [new TextEncoder().encode('ipfs://meta-1.json')],
    });

    // Associate spender and recipient with the token
    await spenderWrapper.associateToken({
      accountId: spenderAccountId.toString(),
      tokenId: nftTokenId,
    });
  });

  beforeEach(async () => {
    // Approve NFT allowance for the spender before each test
    await ownerWrapper.approveNftAllowance({
      nftApprovals: [
        new TokenNftAllowance({
          tokenId: TokenId.fromString(nftTokenId),
          ownerAccountId,
          spenderAccountId,
          serialNumbers: [Long.fromNumber(1)],
          allSerials: false,
          delegatingSpender: null,
        }),
      ],
      transactionMemo: 'Approve NFT allowance',
    });
  });

  afterAll(async () => {
    try {
      await returnHbarsAndDeleteAccount(
        ownerWrapper,
        spenderAccountId,
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
    spenderClient?.close();
    operatorClient?.close();
  });

  it('should transfer NFT via allowance to recipient', async () => {
    const input = `Transfer NFT with allowance from ${ownerAccountId.toString()} to ${spenderAccountId.toString()} with serial number 1 of ${nftTokenId}`;

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
    await wait(MIRROR_NODE_WAITING_TIME);

    const recipientNfts = await ownerWrapper.getAccountNfts(spenderAccountId.toString());
    expect(
      recipientNfts.nfts.find(nft => nft.token_id === nftTokenId && nft.serial_number === 1),
    ).toBeTruthy();
  });
});
