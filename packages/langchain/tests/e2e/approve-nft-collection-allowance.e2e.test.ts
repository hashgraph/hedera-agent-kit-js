import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  AccountId,
  Client,
  NftId,
  PublicKey,
  TokenId,
  TokenMintTransaction,
  TokenSupplyType,
  TokenType,
  TransferTransaction,
} from '@hiero-ledger/sdk';
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

/**
 * E2E: Approve allowance for the entire NFT collection (all serials)
 */
describe('Approve NFT Collection Allowance (all serials) E2E', () => {
  const profile = getProfile();
  let testSetup: LangchainTestSetup;
  let agent: ReactAgent;
  let responseParsingService: ResponseParserService;

  let owner: TestAccount;
  let ownerClient: Client; // owner/treasury/executor
  let ownerWrapper: HederaOperationsWrapper;

  let spender: TestAccount;
  let spenderClient: Client;
  let spenderWrapper: HederaOperationsWrapper;

  let recipient: TestAccount;
  let recipientClient: Client;
  let recipientWrapper: HederaOperationsWrapper;

  let nftTokenId: string;

  beforeAll(async () => {
    // 1) Create owner (executor) account and client
    owner = await profile.accounts.acquire({ tier: 'STANDARD' });
    ({ client: ownerClient, wrapper: ownerWrapper } = profile.client.connectAs(owner));

    // 2) Create spender account + client
    spender = await profile.accounts.acquire({ tier: 'STANDARD' });
    ({ client: spenderClient, wrapper: spenderWrapper } = profile.client.connectAs(spender));

    // 3) Create a recipient account + client
    recipient = await profile.accounts.acquire({ tier: 'STANDARD' });
    ({ client: recipientClient, wrapper: recipientWrapper } = profile.client.connectAs(recipient));

    // 4) Start LangChain test setup with the owner client (so the agent acts as owner)
    testSetup = await createLangchainTestSetup(undefined, undefined, ownerClient);
    agent = testSetup.agent;
    responseParsingService = testSetup.responseParser;

    // 5) Create an HTS NFT with owner as treasury/admin/supply
    const createResp = await ownerWrapper.createNonFungibleToken({
      tokenName: 'AK-NFT-ALL-E2E',
      tokenSymbol: 'AKNA',
      tokenMemo: 'Approve ALL serials allowance E2E',
      tokenType: TokenType.NonFungibleUnique,
      supplyType: TokenSupplyType.Finite,
      maxSupply: 10,
      adminKey: owner.privateKey.publicKey as PublicKey,
      supplyKey: owner.privateKey.publicKey as PublicKey,
      treasuryAccountId: owner.accountId.toString(),
      autoRenewAccountId: owner.accountId.toString(),
    });
    nftTokenId = createResp.tokenId!.toString();

    // 6) Associate spender and recipient with the NFT token
    await spenderWrapper.associateToken({
      accountId: spender.accountId.toString(),
      tokenId: nftTokenId,
    });
    const recipAssocResp = await recipientWrapper.associateToken({
      accountId: recipient.accountId.toString(),
      tokenId: nftTokenId,
    });

    await waitForMirrorTx(ownerWrapper, recipAssocResp.transactionId!);
  }, 180_000);

  afterAll(async () => {
    await profile.accounts.release(recipient);
    await profile.accounts.release(spender);
    await profile.accounts.release(owner);
    testSetup?.cleanup();
    ownerClient?.close();
    spenderClient?.close();
    recipientClient?.close();
  });

  it(
    'approves allowance for all serials and transfers a newly minted serial',
    itWithRetry(async () => {
      // Approve for all serials
      const input = `Approve NFT allowance for all serials of token ${nftTokenId} from ${owner.accountId.toString()} to ${spender.accountId.toString()}`;

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

      // Wait for mirror node/allowance propagation
      await waitForMirrorTx(ownerWrapper, parsedResponse[0].parsedData.raw.transactionId);

      // Mint a new serial AFTER approval to ensure future serials are covered
      const mintTx = new TokenMintTransaction()
        .setTokenId(TokenId.fromString(nftTokenId))
        .setMetadata([Buffer.from('ipfs://meta-future-1.json')]);
      const mintResp = await mintTx.execute(ownerClient);
      const rcpt = await mintResp.getReceipt(ownerClient);
      expect(rcpt.status.toString()).toBe('SUCCESS');

      // The minted serial will be the next available; for simplicity, query info to get the latest serial
      // However, we can attempt with serial 1 as well by minting earlier; to keep minimal, we assume first mint => serial 1
      const serialToTransfer = 1; // first minted serial for this token in this test

      // Using a spender client, perform an approved transfer from owner to recipient
      const nft = new NftId(TokenId.fromString(nftTokenId), serialToTransfer);
      const tx = new TransferTransaction().addApprovedNftTransfer(
        nft,
        AccountId.fromString(owner.accountId.toString()),
        AccountId.fromString(recipient.accountId.toString()),
      );
      const exec = await tx.execute(spenderClient);
      const transferRcpt = await exec.getReceipt(spenderClient);
      expect(transferRcpt.status.toString()).toBe('SUCCESS');

      // Verify ownership now belongs to the recipient
      const info = await spenderWrapper.getNftInfo(nftTokenId, serialToTransfer);
      expect(info).toBeDefined();
      // @ts-ignore validated existence above
      expect(info.at(0).accountId?.toString()).toBe(recipient.accountId.toString());
    }),
    180_000,
  );
});
