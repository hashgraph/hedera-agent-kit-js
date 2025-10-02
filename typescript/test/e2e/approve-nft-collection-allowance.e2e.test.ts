import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  AccountId,
  Client,
  Key,
  NftId,
  PrivateKey,
  PublicKey,
  TokenId,
  TokenMintTransaction,
  TokenSupplyType,
  TokenType,
  TransferTransaction,
} from '@hashgraph/sdk';
import {
  createLangchainTestSetup,
  getCustomClient,
  getOperatorClientForTests,
  HederaOperationsWrapper,
  type LangchainTestSetup,
} from '../utils';
import { extractObservationFromLangchainResponse, wait } from '../utils/general-util';
import { MIRROR_NODE_WAITING_TIME } from '../utils/test-constants';
import { returnHbarsAndDeleteAccount } from '../utils/teardown/account-teardown';
import { itWithRetry } from '../utils/retry-util';

/**
 * E2E: Approve allowance for the entire NFT collection (all serials)
 */
describe('Approve NFT Collection Allowance (all serials) E2E', () => {
  let testSetup: LangchainTestSetup;
  let agentExecutor: any;

  let operatorClient: Client;
  let operatorWrapper: HederaOperationsWrapper;

  let ownerClient: Client; // owner/treasury/executor
  let ownerWrapper: HederaOperationsWrapper;

  let spenderAccount: AccountId; // spender who will get collection-wide approval
  let spenderKey: PrivateKey;
  let spenderClient: Client;
  let spenderWrapper: HederaOperationsWrapper;

  let recipientAccount: AccountId; // recipient to receive NFT in approved transfer
  let recipientKey: PrivateKey;
  let recipientClient: Client;
  let recipientWrapper: HederaOperationsWrapper;

  let nftTokenId: string;

  beforeAll(async () => {
    // 1) Operator funds accounts
    operatorClient = getOperatorClientForTests();
    operatorWrapper = new HederaOperationsWrapper(operatorClient);

    // 2) Create owner (executor) account and client
    const ownerKey = PrivateKey.generateED25519();
    const ownerAccountId = await operatorWrapper
      .createAccount({ key: ownerKey.publicKey, initialBalance: 50 })
      .then(resp => resp.accountId!);

    ownerClient = getCustomClient(ownerAccountId, ownerKey);
    ownerWrapper = new HederaOperationsWrapper(ownerClient);

    // 3) Create spender account + client
    spenderKey = PrivateKey.generateED25519();
    spenderAccount = await ownerWrapper
      .createAccount({ key: spenderKey.publicKey as Key, initialBalance: 15 })
      .then(resp => resp.accountId!);
    spenderClient = getCustomClient(spenderAccount, spenderKey);
    spenderWrapper = new HederaOperationsWrapper(spenderClient);

    // 4) Create a recipient account + client
    recipientKey = PrivateKey.generateED25519();
    recipientAccount = await ownerWrapper
      .createAccount({ key: recipientKey.publicKey as Key, initialBalance: 15 })
      .then(resp => resp.accountId!);
    recipientClient = getCustomClient(recipientAccount, recipientKey);
    recipientWrapper = new HederaOperationsWrapper(recipientClient);

    // 5) Start LangChain test setup with the owner client (so the agent acts as owner)
    testSetup = await createLangchainTestSetup(undefined, undefined, ownerClient);
    agentExecutor = testSetup.agentExecutor;

    // 6) Create an HTS NFT with owner as treasury/admin/supply
    const createResp = await ownerWrapper.createNonFungibleToken({
      tokenName: 'AK-NFT-ALL-E2E',
      tokenSymbol: 'AKNA',
      tokenMemo: 'Approve ALL serials allowance E2E',
      tokenType: TokenType.NonFungibleUnique,
      supplyType: TokenSupplyType.Finite,
      maxSupply: 10,
      adminKey: ownerClient.operatorPublicKey! as PublicKey,
      supplyKey: ownerClient.operatorPublicKey! as PublicKey,
      treasuryAccountId: ownerClient.operatorAccountId!.toString(),
      autoRenewAccountId: ownerClient.operatorAccountId!.toString(),
    });
    nftTokenId = createResp.tokenId!.toString();

    // 7) Associate spender and recipient with the NFT token
    await spenderWrapper.associateToken({
      accountId: spenderAccount.toString(),
      tokenId: nftTokenId,
    });
    await recipientWrapper.associateToken({
      accountId: recipientAccount.toString(),
      tokenId: nftTokenId,
    });

    await wait(MIRROR_NODE_WAITING_TIME);
  }, 180_000);

  afterAll(async () => {
    try {
      if (recipientWrapper) {
        await returnHbarsAndDeleteAccount(
          recipientWrapper,
          recipientAccount,
          operatorClient.operatorAccountId!,
        );
      }
      if (spenderWrapper) {
        await returnHbarsAndDeleteAccount(
          spenderWrapper,
          spenderAccount,
          operatorClient.operatorAccountId!,
        );
      }
      if (ownerWrapper) {
        await returnHbarsAndDeleteAccount(
          ownerWrapper,
          ownerClient.operatorAccountId!,
          operatorClient.operatorAccountId!,
        );
      }
    } finally {
      testSetup?.cleanup();
      operatorClient?.close();
      ownerClient?.close();
      spenderClient?.close();
      recipientClient?.close();
    }
  });

  it(
    'approves allowance for all serials and transfers a newly minted serial',
    itWithRetry(async () => {
      // Approve for all serials
      const input = `Approve NFT allowance for all serials of token ${nftTokenId} from ${ownerClient.operatorAccountId!.toString()} to ${spenderAccount.toString()}`;

      const result = await agentExecutor.invoke({ input });
      const observation = extractObservationFromLangchainResponse(result);

      expect(observation).toBeDefined();
      expect(observation.raw.status.toString()).toBe('SUCCESS');
      expect(observation.raw.transactionId).toBeDefined();

      // Wait for mirror node/allowance propagation
      await wait(MIRROR_NODE_WAITING_TIME);

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
        AccountId.fromString(ownerClient.operatorAccountId!.toString()),
        AccountId.fromString(recipientAccount.toString()),
      );
      const exec = await tx.execute(spenderClient);
      const transferRcpt = await exec.getReceipt(spenderClient);
      expect(transferRcpt.status.toString()).toBe('SUCCESS');

      // Verify ownership now belongs to the recipient
      const info = await spenderWrapper.getNftInfo(nftTokenId, serialToTransfer);
      expect(info).toBeDefined();
      // @ts-ignore validated existence above
      expect(info.at(0).accountId?.toString()).toBe(recipientAccount.toString());
    }),
    180_000,
  );
});
