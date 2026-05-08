import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  Client,
  PublicKey,
  TokenId,
  TokenType,
  TokenSupplyType,
  TokenNftAllowance,
  Long,
} from '@hiero-ledger/sdk';
import { AgentMode, type Context } from '@/shared/configuration';
import {
  getProfile,
  HederaOperationsWrapper,
  type TestAccount,
} from '@hashgraph/hedera-agent-kit-tests';
import transferNonFungibleTokenWithAllowance from '@/plugins/core-token-plugin/tools/non-fungible-token/transfer-non-fungible-token-with-allowance';
import { mintNonFungibleTokenParametersNormalised } from '@/shared/parameter-schemas/token.zod';
import { z } from 'zod';
import { waitForMirrorTx } from '@hashgraph/hedera-agent-kit-tests';

describe('Transfer NFT With Allowance Integration Tests', () => {
  const profile = getProfile();
  let owner: TestAccount;
  let spender: TestAccount;
  let ownerClient: Client;
  let spenderClient: Client;
  let ownerWrapper: HederaOperationsWrapper;
  let spenderWrapper: HederaOperationsWrapper;
  let nftTokenId: string;
  let context: Context;

  beforeAll(async () => {
    owner = await profile.accounts.acquire({ tier: 'ELEVATED' });
    ({ client: ownerClient, wrapper: ownerWrapper } = profile.client.connectAs(owner));

    spender = await profile.accounts.acquire({ tier: 'STANDARD' });
    ({ client: spenderClient, wrapper: spenderWrapper } = profile.client.connectAs(spender));

    context = {
      mode: AgentMode.AUTONOMOUS,
      accountId: spender.accountId.toString(),
    };

    const tokenCreate = await ownerWrapper.createNonFungibleToken({
      tokenName: 'TestNFT',
      tokenSymbol: 'TNFT',
      tokenMemo: 'Transfer allowance integration',
      tokenType: TokenType.NonFungibleUnique,
      supplyType: TokenSupplyType.Finite,
      maxSupply: 10,
      treasuryAccountId: owner.accountId.toString(),
      adminKey: owner.privateKey.publicKey as PublicKey,
      supplyKey: owner.privateKey.publicKey as PublicKey,
      autoRenewAccountId: owner.accountId.toString(),
    });
    nftTokenId = tokenCreate.tokenId!.toString();

    const mintParams: z.infer<ReturnType<typeof mintNonFungibleTokenParametersNormalised>> = {
      tokenId: nftTokenId,
      metadata: [new TextEncoder().encode('ipfs://meta-a.json')],
    };

    await ownerWrapper.mintNft(mintParams);

    await spenderWrapper.associateToken({
      accountId: spender.accountId.toString(),
      tokenId: nftTokenId,
    });
  });

  afterAll(async () => {
    await profile.accounts.release(spender);
    await profile.accounts.release(owner);
    ownerClient?.close();
    spenderClient?.close();
  });

  it('should transfer NFT via approved allowance', async () => {
    await ownerWrapper.approveNftAllowance({
      nftApprovals: [
        new TokenNftAllowance({
          delegatingSpender: null,
          serialNumbers: [Long.fromNumber(1)],
          tokenId: TokenId.fromString(nftTokenId),
          ownerAccountId: owner.accountId,
          spenderAccountId: spender.accountId,
          allSerials: false,
        }),
      ],
      transactionMemo: 'Approve NFT allowance',
    });

    const params = {
      sourceAccountId: owner.accountId.toString(),
      tokenId: nftTokenId,
      recipients: [{ recipientId: spender.accountId.toString(), serialNumber: 1 }],
      transactionMemo: 'NFT allowance transfer',
    };

    const tool = transferNonFungibleTokenWithAllowance(context);
    const result = await tool.execute(spenderClient, context, params);

    expect(result.raw.status).toBe('SUCCESS');
    expect(result.humanMessage).toContain(
      'Non-fungible tokens successfully transferred with allowance. Transaction ID:',
    );
    await waitForMirrorTx(spenderWrapper, result.raw.transactionId);
    const spenderNfts = await spenderWrapper.getAccountNfts(spender.accountId.toString());
    expect(
      spenderNfts.nfts.find(nft => nft.token_id === nftTokenId && nft.serial_number === 1),
    ).toBeTruthy();
  });
});
