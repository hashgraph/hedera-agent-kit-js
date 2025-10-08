import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  AccountId,
  Client,
  PrivateKey,
  PublicKey,
  TokenId,
  TokenType,
  TokenSupplyType,
  TokenNftAllowance,
  Long,
} from '@hashgraph/sdk';
import { AgentMode, Context } from '@/shared/configuration';
import { getCustomClient, getOperatorClientForTests, HederaOperationsWrapper } from '../../utils';
import { returnHbarsAndDeleteAccount } from '../../utils/teardown/account-teardown';
import transferNonFungibleTokenWithAllowance from '@/plugins/core-token-plugin/tools/non-fungible-token/transfer-non-fungible-token-with-allowance';
import { mintNonFungibleTokenParametersNormalised } from '@/shared/parameter-schemas/token.zod';
import { z } from 'zod';
import { MIRROR_NODE_WAITING_TIME } from '../../utils/test-constants';
import { wait } from '../../utils/general-util';

describe('Transfer NFT With Allowance Integration Tests', () => {
  let operatorClient: Client;
  let ownerClient: Client;
  let spenderClient: Client;
  let ownerWrapper: HederaOperationsWrapper;
  let ownerAccountId: AccountId;
  let spenderAccountId: AccountId;
  let spenderWrapper: HederaOperationsWrapper;
  let nftTokenId: string;
  let context: Context;

  beforeAll(async () => {
    operatorClient = getOperatorClientForTests();
    ownerWrapper = new HederaOperationsWrapper(operatorClient);

    // Create an owner (a treasury) account
    const ownerKey = PrivateKey.generateED25519();
    ownerAccountId = await ownerWrapper
      .createAccount({ initialBalance: 35, key: ownerKey.publicKey })
      .then(resp => resp.accountId!);
    ownerClient = getCustomClient(ownerAccountId, ownerKey);
    ownerWrapper = new HederaOperationsWrapper(ownerClient);

    // Create a spender account
    const spenderKey = PrivateKey.generateECDSA();
    spenderAccountId = await ownerWrapper
      .createAccount({ initialBalance: 20, key: spenderKey.publicKey })
      .then(resp => resp.accountId!);
    spenderClient = getCustomClient(spenderAccountId, spenderKey);
    spenderWrapper = new HederaOperationsWrapper(spenderClient);

    // Context for tool execution (spender executes)
    context = {
      mode: AgentMode.AUTONOMOUS,
      accountId: spenderAccountId.toString(),
    };

    // Create NFT token
    const tokenCreate = await ownerWrapper.createNonFungibleToken({
      tokenName: 'TestNFT',
      tokenSymbol: 'TNFT',
      tokenMemo: 'Transfer allowance integration',
      tokenType: TokenType.NonFungibleUnique,
      supplyType: TokenSupplyType.Finite,
      maxSupply: 10,
      treasuryAccountId: ownerAccountId.toString(),
      adminKey: ownerClient.operatorPublicKey! as PublicKey,
      supplyKey: ownerClient.operatorPublicKey! as PublicKey,
      autoRenewAccountId: ownerAccountId.toString(),
    });
    nftTokenId = tokenCreate.tokenId!.toString();

    // Mint NFTs via the mintNft method instead of SDK directly
    const mintParams: z.infer<ReturnType<typeof mintNonFungibleTokenParametersNormalised>> = {
      tokenId: nftTokenId,
      metadata: [new TextEncoder().encode('ipfs://meta-a.json')],
    };

    await ownerWrapper.mintNft(mintParams);

    // Associate spender with token
    await spenderWrapper.associateToken({
      accountId: spenderAccountId.toString(),
      tokenId: nftTokenId,
    });
  });

  afterAll(async () => {
    try {
      // Cleanup accounts and HBARs
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

  it('should transfer NFT via approved allowance', async () => {
    // Approve NFT allowance using normalized tokenApprovals
    await ownerWrapper.approveNftAllowance({
      nftApprovals: [
        new TokenNftAllowance({
          delegatingSpender: null,
          serialNumbers: [Long.fromNumber(1)],
          tokenId: TokenId.fromString(nftTokenId),
          ownerAccountId,
          spenderAccountId,
          allSerials: false,
        }),
      ],
      transactionMemo: 'Approve NFT allowance',
    });

    const params = {
      sourceAccountId: ownerAccountId.toString(),
      tokenId: nftTokenId,
      recipients: [{ recipientId: spenderAccountId.toString(), serialNumber: 1 }],
      transactionMemo: 'NFT allowance transfer',
    };

    const tool = transferNonFungibleTokenWithAllowance(context);
    const result = await tool.execute(spenderClient, context, params);

    expect(result.raw.status).toBe('SUCCESS');
    expect(result.humanMessage).toContain(
      'Non-fungible tokens successfully transferred with allowance. Transaction ID:',
    );
    await wait(MIRROR_NODE_WAITING_TIME);
    const spenderNfts = await spenderWrapper.getAccountNfts(spenderAccountId.toString());
    expect(
      spenderNfts.nfts.find(nft => nft.token_id === nftTokenId && nft.serial_number === 1),
    ).toBeTruthy();
  });
});
