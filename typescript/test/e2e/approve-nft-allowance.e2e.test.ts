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
import approveNftAllowanceTool from '@/plugins/core-token-plugin/tools/non-fungible-token/approve-non-fungible-token-allowance';
import { approveNftAllowanceParameters } from '@/shared/parameter-schemas/token.zod';
import {
  createLangchainTestSetup,
  getCustomClient,
  getOperatorClientForTests,
  HederaOperationsWrapper,
  type LangchainTestSetup,
} from '../utils';
import { wait } from '../utils/general-util';
import { MIRROR_NODE_WAITING_TIME } from '../utils/test-constants';
import { z } from 'zod';
import { returnHbarsAndDeleteAccount } from '../utils/teardown/account-teardown';
import { itWithRetry } from '../utils/retry-util';

/**
 * E2E test: Create an HTS NFT, approve NFT allowance for a spender, then verify the spender
 * can transfer the NFT using an approved transfer.
 */

describe('Approve NFT Allowance E2E', () => {
  let testSetup: LangchainTestSetup;

  let operatorClient: Client;
  let operatorWrapper: HederaOperationsWrapper;

  let ownerClient: Client; // owner/treasury/executor
  let ownerWrapper: HederaOperationsWrapper;

  let spenderAccount: AccountId; // Account A (spender)
  let spenderKey: PrivateKey;
  let spenderClient: Client;
  let spenderWrapper: HederaOperationsWrapper;

  let nftTokenId: string;
  const serialToUse = 1; // we'll mint at least one NFT and use serial 1

  let recipientAccount: AccountId; // separate recipient to receive NFT
  let recipientClient: Client;
  let recipientWrapper: HederaOperationsWrapper;

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

    // 3) Create a spender account with its own key and client
    spenderKey = PrivateKey.generateED25519();
    spenderAccount = await ownerWrapper
      .createAccount({ key: spenderKey.publicKey as Key, initialBalance: 15 })
      .then(resp => resp.accountId!);

    spenderClient = getCustomClient(spenderAccount, spenderKey);
    spenderWrapper = new HederaOperationsWrapper(spenderClient);

    // 3b) Create a separate recipient account (simple key, no custom client needed for transfer)
    const recipientKey = PrivateKey.generateED25519();
    recipientAccount = await ownerWrapper
      .createAccount({ key: recipientKey.publicKey as Key, initialBalance: 15 })
      .then(resp => resp.accountId!);
    recipientClient = getCustomClient(recipientAccount, recipientKey);
    recipientWrapper = new HederaOperationsWrapper(recipientClient);

    // 4) Start LangChain test setup with the owner client
    testSetup = await createLangchainTestSetup(undefined, undefined, ownerClient);

    // 5) Create an HTS NFT with an owner as treasury/admin/supply keys
    const createResp = await ownerWrapper.createNonFungibleToken({
      tokenName: 'AK-NFT-E2E',
      tokenSymbol: 'AKNE',
      tokenMemo: 'Approve NFT allowance E2E',
      tokenType: TokenType.NonFungibleUnique,
      supplyType: TokenSupplyType.Finite,
      maxSupply: 10,
      adminKey: ownerClient.operatorPublicKey! as PublicKey,
      supplyKey: ownerClient.operatorPublicKey! as PublicKey,
      treasuryAccountId: ownerClient.operatorAccountId!.toString(),
      autoRenewAccountId: ownerClient.operatorAccountId!.toString(),
    });
    nftTokenId = createResp.tokenId!.toString();

    // 6) Mint at least one serial for the NFT using the SDK directly (no other tool)
    const mintTx = new TokenMintTransaction()
      .setTokenId(TokenId.fromString(nftTokenId))
      .setMetadata([Buffer.from('ipfs://meta-1.json')]);
    const mintResp = await mintTx.execute(ownerClient);
    await mintResp.getReceipt(ownerClient);

    // 7) Associate spender and recipient with the NFT token (must be signed by each account)
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
    'should approve NFT allowance and allow spender to transfer via approved transfer',
    itWithRetry(async () => {
      // Approve NFT allowance (explicit tool invocation for determinism)
      const approveTool = approveNftAllowanceTool({});
      const approveParams: z.infer<ReturnType<typeof approveNftAllowanceParameters>> = {
        ownerAccountId: ownerClient.operatorAccountId!.toString(),
        spenderAccountId: spenderAccount.toString(),
        tokenId: nftTokenId,
        serialNumbers: [serialToUse],
        transactionMemo: 'E2E approve NFT allowance',
      };
      const approveResult = await approveTool.execute(ownerClient, {}, approveParams);
      expect(approveResult.raw.status).toBe('SUCCESS');

      // Give the network a moment to process the allowance
      await wait(MIRROR_NODE_WAITING_TIME);

      // Now, using a spender client, perform an approved NFT transfer from owner to recipient via SDK directly
      const nft = new NftId(TokenId.fromString(nftTokenId), serialToUse);
      const tx = new TransferTransaction().addApprovedNftTransfer(
        nft,
        AccountId.fromString(ownerClient.operatorAccountId!.toString()),
        AccountId.fromString(recipientAccount.toString()),
      );
      const exec = await tx.execute(spenderClient);
      const rcpt = await exec.getReceipt(spenderClient);
      expect(rcpt.status.toString()).toBe('SUCCESS');

      // Optional: verify ownership moved to recipient
      const nftInfo = await spenderWrapper.getNftInfo(nftTokenId, serialToUse);
      expect(nftInfo).toBeDefined();
      // @ts-ignore checked above
      expect(nftInfo.at(0).accountId?.toString()).toBe(recipientAccount.toString());
    }),
    180_000,
  );
});
