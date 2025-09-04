import {
  AccountBalanceQuery,
  AccountId,
  AccountInfoQuery,
  Client,
  NftId,
  TokenAssociateTransaction,
  TokenId,
  TokenInfoQuery,
  TokenNftInfoQuery,
  TopicId,
  TopicInfoQuery,
  TransferTransaction,
} from '@hashgraph/sdk';
import BigNumber from 'bignumber.js';
import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import { z } from 'zod';
import {
  createAccountParametersNormalised,
  deleteAccountParametersNormalised,
  transferHbarParametersNormalised,
} from '@/shared/parameter-schemas/account.zod';
import {
  createFungibleTokenParametersNormalised,
  createNonFungibleTokenParametersNormalised,
  deleteTokenParametersNormalised,
} from '@/shared/parameter-schemas/token.zod';
import {
  createTopicParametersNormalised,
  deleteTopicParametersNormalised,
  submitTopicMessageParametersNormalised,
} from '@/shared/parameter-schemas/consensus.zod';
import { ExecuteStrategy } from '@/shared/strategies/tx-mode-strategy';

class HederaOperationsWrapper {
  private executeStrategy = new ExecuteStrategy();
  constructor(private client: Client) {}

  // ACCOUNT OPERATIONS
  async createAccount(
    params: z.infer<ReturnType<typeof createAccountParametersNormalised>>,
  ): Promise<AccountId> {
    const tx = HederaBuilder.createAccount(params);
    const result = await this.executeStrategy.handle(tx, this.client, {});
    return result.raw.accountId!;
  }

  async deleteAccount(
    params: z.infer<ReturnType<typeof deleteAccountParametersNormalised>>,
  ): Promise<string> {
    const tx = HederaBuilder.deleteAccount(params);
    const result = await this.executeStrategy.handle(tx, this.client, {});
    return result.raw.status;
  }

  // TOKEN OPERATIONS
  async createFungibleToken(
    params: z.infer<ReturnType<typeof createFungibleTokenParametersNormalised>>,
  ): Promise<TokenId> {
    const tx = HederaBuilder.createFungibleToken(params);
    const result = await this.executeStrategy.handle(tx, this.client, {});
    return result.raw.tokenId!;
  }

  async createNonFungibleToken(
    params: z.infer<ReturnType<typeof createNonFungibleTokenParametersNormalised>>,
  ): Promise<TokenId> {
    const tx = HederaBuilder.createNonFungibleToken(params);
    const result = await this.executeStrategy.handle(tx, this.client, {});
    if (result.raw.status !== 'SUCCESS') {
      throw new Error(result.raw.status);
    }
    return result.raw.tokenId!;
  }

  async deleteToken(
    params: z.infer<ReturnType<typeof deleteTokenParametersNormalised>>,
  ): Promise<string> {
    const tx = HederaBuilder.deleteToken(params);
    const result = await this.executeStrategy.handle(tx, this.client, {});
    if (result.raw.status !== 'SUCCESS') {
      throw new Error(result.raw.status);
    }
    return result.raw.status;
  }

  // TOPIC OPERATIONS
  async createTopic(
    params: z.infer<ReturnType<typeof createTopicParametersNormalised>>,
  ): Promise<TopicId> {
    const tx = HederaBuilder.createTopic(params);
    const result = await this.executeStrategy.handle(tx, this.client, {});
    if (result.raw.status !== 'SUCCESS') {
      throw new Error(result.raw.status);
    }
    return result.raw.topicId!;
  }

  async deleteTopic(
    params: z.infer<ReturnType<typeof deleteTopicParametersNormalised>>,
  ): Promise<string> {
    const tx = HederaBuilder.deleteTopic(params);
    const result = await this.executeStrategy.handle(tx, this.client, {});
    if (result.raw.status !== 'SUCCESS') {
      throw new Error(result.raw.status);
    }
    return result.raw.status;
  }

  async submitMessage(
    params: z.infer<ReturnType<typeof submitTopicMessageParametersNormalised>>,
  ): Promise<string> {
    const tx = HederaBuilder.submitTopicMessage(params);
    const result = await this.executeStrategy.handle(tx, this.client, {});
    if (result.raw.status !== 'SUCCESS') {
      throw new Error(result.raw.status);
    }
    return result.raw.status;
  }

  // TRANSFERS AND AIRDROPS
  async transferHbar(
    params: z.infer<ReturnType<typeof transferHbarParametersNormalised>>,
  ): Promise<string> {
    const tx = HederaBuilder.transferHbar(params);
    const result = await this.executeStrategy.handle(tx, this.client, {});
    if (result.raw.status !== 'SUCCESS') {
      throw new Error(result.raw.status);
    }
    return result.raw.status;
  }

  async transferFungible(params: {
    tokenId: string;
    from?: string;
    to: string;
    amount: number;
  }): Promise<string> {
    const tx = new TransferTransaction()
      .addTokenTransfer(
        TokenId.fromString(params.tokenId),
        AccountId.fromString(params.to),
        params.amount,
      )
      .addTokenTransfer(
        TokenId.fromString(params.tokenId),
        AccountId.fromString(params.from ?? (this.client as any)._operatorAccountId.toString()),
        -params.amount,
      );

    const result = await this.executeStrategy.handle(tx, this.client, {});
    if (result.raw.status !== 'SUCCESS') {
      throw new Error(result.raw.status);
    }
    return result.raw.status;
  }

  async transferNft(params: {
    tokenId: string;
    serial: number;
    from?: string;
    to: string;
    memo?: string;
  }): Promise<string> {
    const nft = new NftId(TokenId.fromString(params.tokenId), params.serial);
    const tx = new TransferTransaction().addNftTransfer(
      nft,
      AccountId.fromString(params.from ?? (this.client as any)._operatorAccountId.toString()),
      AccountId.fromString(params.to),
    );

    const result = await this.executeStrategy.handle(tx, this.client, {});
    if (result.raw.status !== 'SUCCESS') {
      throw new Error(result.raw.status);
    }
    return result.raw.status;
  }

  async associateToken(params: { accountId: string; tokenId: string }): Promise<string> {
    const tx = new TokenAssociateTransaction({
      accountId: AccountId.fromString(params.accountId),
      tokenIds: [TokenId.fromString(params.tokenId)],
    });
    const result = await this.executeStrategy.handle(tx, this.client, {});
    if (result.raw.status !== 'SUCCESS') {
      throw new Error(result.raw.status);
    }
    return result.raw.status;
  }

  async getAccountBalances(accountId: string) {
    const query = new AccountBalanceQuery().setAccountId(AccountId.fromString(accountId));
    return await query.execute(this.client);
  }

  async getAccountInfo(accountId: string) {
    const query = new AccountInfoQuery().setAccountId(AccountId.fromString(accountId));
    return await query.execute(this.client);
  }

  async getTopicInfo(topicId: string) {
    const query = new TopicInfoQuery().setTopicId(TopicId.fromString(topicId));
    return await query.execute(this.client);
  }

  async getTokenInfo(tokenId: string) {
    const query = new TokenInfoQuery().setTokenId(TokenId.fromString(tokenId));
    return await query.execute(this.client);
  }

  async getNftInfo(tokenId: string, serial: number) {
    const query = new TokenNftInfoQuery({ nftId: new NftId(TokenId.fromString(tokenId), serial) });
    return await query.execute(this.client);
  }

  async getAccountTokenBalances(accountId: string, tokenId: string) {
    const accountTokenBalances = await this.getAccountBalances(accountId);
    const tokenIdObj = TokenId.fromString(tokenId);
    const balance = accountTokenBalances.tokens?.get(tokenIdObj) ?? 0;
    const decimals = accountTokenBalances.tokenDecimals?.get(tokenIdObj) ?? 0;
    return { balance, decimals };
  }

  /**
   * return HBAR balance of an account in tinybars
   *
   * @param accountId
   */
  async getAccountHbarBalance(accountId: string): Promise<BigNumber> {
    const accountInfo = await this.getAccountInfo(accountId);
    const balance = accountInfo.balance;
    return new BigNumber(balance.toTinybars().toNumber());
  }
}

export default HederaOperationsWrapper;
