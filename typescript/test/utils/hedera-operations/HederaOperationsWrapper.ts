import {
  AccountBalanceQuery,
  AccountId,
  AccountInfoQuery,
  Client,
  ContractId,
  ContractInfo,
  ContractInfoQuery,
  ContractCreateFlow,
  LedgerId,
  NftId,
  TokenAssociateTransaction,
  TokenId,
  TokenInfoQuery,
  TokenNftInfoQuery,
  TopicId,
  TopicInfoQuery,
  TransactionRecordQuery,
  TransferTransaction,
} from '@hashgraph/sdk';
import BigNumber from 'bignumber.js';
import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import { z } from 'zod';
import {
  approveHbarAllowanceParametersNormalised,
  approveTokenAllowanceParametersNormalised,
  createAccountParametersNormalised,
  deleteAccountParametersNormalised,
  transferHbarParametersNormalised,
} from '@/shared/parameter-schemas/account.zod';
import {
  createFungibleTokenParametersNormalised,
  createNonFungibleTokenParametersNormalised,
  deleteTokenParametersNormalised,
  airdropFungibleTokenParametersNormalised,
  approveNftAllowanceParametersNormalised,
  mintNonFungibleTokenParametersNormalised,
} from '@/shared/parameter-schemas/token.zod';
import {
  createTopicParametersNormalised,
  deleteTopicParametersNormalised,
  submitTopicMessageParametersNormalised,
} from '@/shared/parameter-schemas/consensus.zod';
import { ExecuteStrategy, ExecuteStrategyResult } from '@/shared/strategies/tx-mode-strategy';
import { RawTransactionResponse } from '@/shared/strategies/tx-mode-strategy';
import { getMirrornodeService } from '@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils';
import {
  TokenAirdropsResponse,
  TokenAllowanceResponse,
  TokenBalance,
  TopicMessagesResponse,
} from '@/shared/hedera-utils/mirrornode/types';
import {
  createERC20Parameters,
  createERC721Parameters,
  mintERC721Parameters,
} from '@/shared/parameter-schemas/evm.zod';
import {
  ERC20_FACTORY_ABI,
  ERC721_FACTORY_ABI,
  ERC721_MINT_FUNCTION_ABI,
  ERC721_MINT_FUNCTION_NAME,
  getERC20FactoryAddress,
  getERC721FactoryAddress,
} from '@/shared';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';

class HederaOperationsWrapper {
  private executeStrategy = new ExecuteStrategy();
  private mirrornode;
  constructor(private client: Client) {
    this.mirrornode = getMirrornodeService(undefined, LedgerId.TESTNET);
  }

  // ACCOUNT OPERATIONS
  async createAccount(
    params: z.infer<ReturnType<typeof createAccountParametersNormalised>>,
  ): Promise<RawTransactionResponse> {
    const tx = HederaBuilder.createAccount(params);
    const result = await this.executeStrategy.handle(tx, this.client, {});
    return {
      status: result.raw.status,
      accountId: result.raw.accountId,
      tokenId: null,
      topicId: null,
      transactionId: result.raw.transactionId,
      scheduleId: null,
    };
  }

  async deleteAccount(
    params: z.infer<ReturnType<typeof deleteAccountParametersNormalised>>,
  ): Promise<RawTransactionResponse> {
    const tx = HederaBuilder.deleteAccount(params);
    const result = await this.executeStrategy.handle(tx, this.client, {});
    return result.raw;
  }

  // TOKEN OPERATIONS
  async createFungibleToken(
    params: z.infer<ReturnType<typeof createFungibleTokenParametersNormalised>>,
  ): Promise<RawTransactionResponse> {
    const tx = HederaBuilder.createFungibleToken(params);
    const result = await this.executeStrategy.handle(tx, this.client, {});
    return result.raw;
  }

  async createNonFungibleToken(
    params: z.infer<ReturnType<typeof createNonFungibleTokenParametersNormalised>>,
  ): Promise<RawTransactionResponse> {
    const tx = HederaBuilder.createNonFungibleToken(params);
    const result = await this.executeStrategy.handle(tx, this.client, {});
    return result.raw;
  }

  async deleteToken(
    params: z.infer<ReturnType<typeof deleteTokenParametersNormalised>>,
  ): Promise<RawTransactionResponse> {
    const tx = HederaBuilder.deleteToken(params);
    const result = await this.executeStrategy.handle(tx, this.client, {});
    return result.raw;
  }

  // TOPIC OPERATIONS
  async createTopic(
    params: z.infer<ReturnType<typeof createTopicParametersNormalised>>,
  ): Promise<RawTransactionResponse> {
    const tx = HederaBuilder.createTopic(params);
    const result = await this.executeStrategy.handle(tx, this.client, {});
    return result.raw;
  }

  async deleteTopic(
    params: z.infer<ReturnType<typeof deleteTopicParametersNormalised>>,
  ): Promise<RawTransactionResponse> {
    const tx = HederaBuilder.deleteTopic(params);
    const result = await this.executeStrategy.handle(tx, this.client, {});
    return result.raw;
  }

  async submitMessage(
    params: z.infer<ReturnType<typeof submitTopicMessageParametersNormalised>>,
  ): Promise<RawTransactionResponse> {
    const tx = HederaBuilder.submitTopicMessage(params);
    const result = await this.executeStrategy.handle(tx, this.client, {});
    return result.raw;
  }

  async getTopicMessages(topicId: string): Promise<TopicMessagesResponse> {
    return await this.mirrornode.getTopicMessages({
      topicId,
      lowerTimestamp: '',
      upperTimestamp: '',
      limit: 100,
    });
  }

  // TRANSFERS AND AIRDROPS
  async transferHbar(
    params: z.infer<ReturnType<typeof transferHbarParametersNormalised>>,
  ): Promise<RawTransactionResponse> {
    const tx = HederaBuilder.transferHbar(params);
    const result = await this.executeStrategy.handle(tx, this.client, {});
    return result.raw;
  }

  async airdropToken(
    params: z.infer<ReturnType<typeof airdropFungibleTokenParametersNormalised>>,
  ): Promise<RawTransactionResponse> {
    const tx = HederaBuilder.airdropFungibleToken(params);
    const result = await this.executeStrategy.handle(tx, this.client, {});
    return result.raw;
  }

  async transferFungible(params: {
    tokenId: string;
    from?: string;
    to: string;
    amount: number;
  }): Promise<RawTransactionResponse> {
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
    return result.raw;
  }

  async transferNft(params: {
    tokenId: string;
    serial: number;
    from?: string;
    to: string;
    memo?: string;
  }): Promise<RawTransactionResponse> {
    const operatorId = (this.client as any)._operatorAccountId.toString();
    const fromId = params.from ?? operatorId;
    const nft = new NftId(TokenId.fromString(params.tokenId), params.serial);

    let tx = new TransferTransaction();

    // If the caller (client operator) is not the owner (from), use approved transfer path
    if (fromId !== operatorId) {
      tx = tx.addApprovedNftTransfer(
        nft,
        AccountId.fromString(fromId),
        AccountId.fromString(params.to),
      );
    } else {
      tx = tx.addNftTransfer(nft, AccountId.fromString(fromId), AccountId.fromString(params.to));
    }

    if (params.memo) {
      tx.setTransactionMemo(params.memo);
    }

    const result = await this.executeStrategy.handle(tx, this.client, {});
    return result.raw;
  }

  async associateToken(params: {
    accountId: string;
    tokenId: string;
  }): Promise<RawTransactionResponse> {
    const tx = new TokenAssociateTransaction({
      accountId: AccountId.fromString(params.accountId),
      tokenIds: [TokenId.fromString(params.tokenId)],
    });
    const result = await this.executeStrategy.handle(tx, this.client, {});
    return result.raw;
  }

  // READ-ONLY QUERIES
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

  async getAccountTokenBalances(
    accountId: string,
  ): Promise<Array<{ tokenId: string; balance: number; decimals: number }>> {
    const accountTokenBalances = await this.getAccountBalances(accountId);
    const balances: Array<{ tokenId: string; balance: number; decimals: number }> = [];
    for (const [tId, balance] of accountTokenBalances.tokens ?? []) {
      const decimals = accountTokenBalances.tokenDecimals?.get(tId) ?? 0;
      balances.push({ tokenId: tId.toString(), balance, decimals });
    }
    return balances;
  }

  async getAccountTokenBalance(
    accountId: string,
    tokenId: string,
  ): Promise<{ tokenId: string; balance: number; decimals: number }> {
    const accountTokenBalances = await this.getAccountBalances(accountId);
    const tokenIdObj = TokenId.fromString(tokenId);
    const balance = accountTokenBalances.tokens?.get(tokenIdObj) ?? 0;
    const decimals = accountTokenBalances.tokenDecimals?.get(tokenIdObj) ?? 0;
    return { tokenId: tokenIdObj.toString(), balance, decimals };
  }

  async getAccountTokenBalanceFromMirrornode(
    accountId: string,
    tokenId: string,
  ): Promise<TokenBalance> {
    const tokenBalances = await this.mirrornode.getAccountTokenBalances(accountId, tokenId);
    const found = tokenBalances.tokens.find(t => t.token_id === tokenId);
    if (!found) {
      throw new Error(`Token balance for tokenId ${tokenId} not found`);
    }
    return found;
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

  async deployERC20(bytecode: string) {
    try {
      const tx = new ContractCreateFlow().setGas(3_000_000).setBytecode(bytecode);

      const response = await tx.execute(this.client);
      const receipt = await response.getReceipt(this.client);

      return {
        contractId: receipt.contractId?.toString(),
        transactionId: response.transactionId.toString(),
      };
    } catch (error) {
      console.error('[HederaOperationsWrapper] Error deploying ERC20:', error);
      throw error;
    }
  }

  async getContractInfo(evmContractAddress: `0x${string}`): Promise<ContractInfo> {
    const query = new ContractInfoQuery().setContractId(
      ContractId.fromEvmAddress(0, 0, evmContractAddress),
    );
    return await query.execute(this.client);
  }

  async getPendingAirdrops(accountId: string): Promise<TokenAirdropsResponse> {
    return await this.mirrornode.getPendingAirdrops(accountId);
  }

  async getOutstandingAirdrops(accountId: string): Promise<TokenAirdropsResponse> {
    return await this.mirrornode.getOutstandingAirdrops(accountId);
  }

  async createERC20(params: z.infer<ReturnType<typeof createERC20Parameters>>) {
    const factoryContractAddress = getERC20FactoryAddress(this.client.ledgerId!);
    const normalisedParams = await HederaParameterNormaliser.normaliseCreateERC20Params(
      params,
      factoryContractAddress,
      ERC20_FACTORY_ABI,
      'deployToken',
      {},
      this.client,
    );
    const tx = HederaBuilder.executeTransaction(normalisedParams);
    const result: ExecuteStrategyResult = await this.executeStrategy.handle(tx, this.client, {});
    const erc20Address = await this.getERCAddress(result.raw.transactionId);
    return {
      ...(result as ExecuteStrategyResult),
      erc20Address: erc20Address?.toString(),
      humanMessage: `ERC20 token created successfully at address ${erc20Address?.toString()}`,
    };
  }

  async createERC721(params: z.infer<ReturnType<typeof createERC721Parameters>>) {
    const factoryContractAddress = getERC721FactoryAddress(this.client.ledgerId!);
    const normalisedParams = await HederaParameterNormaliser.normaliseCreateERC721Params(
      params,
      factoryContractAddress,
      ERC721_FACTORY_ABI,
      'deployToken',
      {},
      this.client,
    );
    const tx = HederaBuilder.executeTransaction(normalisedParams);
    const result: ExecuteStrategyResult = await this.executeStrategy.handle(tx, this.client, {});
    const erc721Address = await this.getERCAddress(result.raw.transactionId);
    return {
      ...(result as ExecuteStrategyResult),
      erc721Address: erc721Address?.toString(),
      humanMessage: `ERC20 token created successfully at address ${erc721Address?.toString()}`,
    };
  }

  async mintERC721(params: z.infer<ReturnType<typeof mintERC721Parameters>>) {
    const normalisedParams = await HederaParameterNormaliser.normaliseMintERC721Params(
      params,
      ERC721_MINT_FUNCTION_ABI,
      ERC721_MINT_FUNCTION_NAME,
      {},
      this.mirrornode,
      this.client,
    );

    const tx = HederaBuilder.executeTransaction(normalisedParams);
    return await this.executeStrategy.handle(tx, this.client, {});
  }

  async getERCAddress(txId: string) {
    const record = await new TransactionRecordQuery().setTransactionId(txId).execute(this.client);
    return '0x' + record.contractFunctionResult?.getAddress(0);
  }

  async getTokenAllowances(
    ownerAccountId: string,
    spenderAccountId: string,
  ): Promise<TokenAllowanceResponse> {
    return await this.mirrornode.getTokenAllowances(ownerAccountId, spenderAccountId);
  }

  async approveHbarAllowance(
    params: z.infer<ReturnType<typeof approveHbarAllowanceParametersNormalised>>,
  ) {
    const tx = HederaBuilder.approveHbarAllowance(params);
    return await this.executeStrategy.handle(tx, this.client, {});
  }

  async approveTokenAllowance(
    params: z.infer<ReturnType<typeof approveTokenAllowanceParametersNormalised>>,
  ): Promise<RawTransactionResponse> {
    const tx = HederaBuilder.approveTokenAllowance(params);
    const result = await this.executeStrategy.handle(tx, this.client, {});
    return result.raw;
  }

  async approveNftAllowance(
    params: z.infer<ReturnType<typeof approveNftAllowanceParametersNormalised>>,
  ): Promise<RawTransactionResponse> {
    const tx = HederaBuilder.approveNftAllowance(params);
    const result = await this.executeStrategy.handle(tx, this.client, {});
    return result.raw;
  }

  async mintNft(
    params: z.infer<ReturnType<typeof mintNonFungibleTokenParametersNormalised>>,
  ): Promise<RawTransactionResponse> {
    const tx = HederaBuilder.mintNonFungibleToken(params);
    const result = await this.executeStrategy.handle(tx, this.client, {});
    return result.raw;
  }

  async getAccountNfts(accountId: string) {
    return await this.mirrornode.getAccountNfts(accountId);
  }

  async getScheduledTransactionDetails(scheduledTxId: string) {
    return await this.mirrornode.getScheduledTransactionDetails(scheduledTxId);
  }
}

export default HederaOperationsWrapper;
