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
import { returnHbarsAndDeleteAccount } from '../utils/teardown/account-teardown';
import { extractObservationFromLangchainResponse, wait } from '../utils/general-util';
import { MIRROR_NODE_WAITING_TIME } from '../utils/test-constants';
import { AgentExecutor } from 'langchain/agents';

describe('Transfer NFT With Allowance E2E Tests', () => {
  let testSetup: LangchainTestSetup;
  let agentExecutor: AgentExecutor;
  let operatorClient: Client;
  let ownerClient: Client;
  let spenderClient: Client;
  let ownerWrapper: HederaOperationsWrapper;
  let spenderWrapper: HederaOperationsWrapper;
  let ownerAccountId: AccountId;
  let spenderAccountId: AccountId;
  let nftTokenId: string;

  beforeAll(async () => {
    operatorClient = getOperatorClientForTests();
    ownerWrapper = new HederaOperationsWrapper(operatorClient);

    // Create a treasury (owner) account
    const ownerKey = PrivateKey.generateED25519();
    ownerAccountId = await ownerWrapper
      .createAccount({ initialBalance: 100, key: ownerKey.publicKey })
      .then(resp => resp.accountId!);
    ownerClient = getCustomClient(ownerAccountId, ownerKey);
    ownerWrapper = new HederaOperationsWrapper(ownerClient);

    // Create a spender account
    const spenderKey = PrivateKey.generateED25519();
    spenderAccountId = await ownerWrapper
      .createAccount({ initialBalance: 50, key: spenderKey.publicKey })
      .then(resp => resp.accountId!);
    spenderClient = getCustomClient(spenderAccountId, spenderKey);
    spenderWrapper = new HederaOperationsWrapper(spenderClient);

    // Set up LangChain executor with spender (who uses allowance)
    testSetup = await createLangchainTestSetup(undefined, undefined, spenderClient);
    agentExecutor = testSetup.agentExecutor;

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

    const transferResult = await agentExecutor.invoke({ input });

    const observation = extractObservationFromLangchainResponse(transferResult);

    expect(observation.raw.status).toBe('SUCCESS');
    expect(observation.humanMessage).toContain(
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
