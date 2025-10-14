import {
  TopicMessagesQueryParams,
  AccountResponse,
  TokenBalancesResponse,
  TopicMessagesResponse,
  TopicInfo,
  TokenInfo,
  TransactionDetailsResponse,
  ContractInfo,
  ExchangeRateResponse,
  TokenAirdropsResponse,
  TokenAllowanceResponse,
  NftBalanceResponse,
  ScheduledTransactionDetailsResponse,
} from './types';

export interface IHederaMirrornodeService {
  getAccount(accountId: string): Promise<AccountResponse>;
  getAccountHbarBalance(accountId: string): Promise<BigNumber>;
  getAccountTokenBalances(accountId: string): Promise<TokenBalancesResponse>;
  getTopicMessages(queryParams: TopicMessagesQueryParams): Promise<TopicMessagesResponse>;
  getTopicInfo(topicId: string): Promise<TopicInfo>;
  getTokenInfo(tokenId: string): Promise<TokenInfo>;
  getContractInfo(contractId: string): Promise<ContractInfo>;
  getTransactionRecord(transactionId: string, nonce?: number): Promise<TransactionDetailsResponse>;
  getExchangeRate(timestamp?: string): Promise<ExchangeRateResponse>;
  getPendingAirdrops(accountId: string): Promise<TokenAirdropsResponse>;
  getOutstandingAirdrops(accountId: string): Promise<TokenAirdropsResponse>;
  getTokenAllowances(
    ownerAccountId: string,
    spenderAccountId: string,
  ): Promise<TokenAllowanceResponse>;
  getAccountNfts(accountId: string): Promise<NftBalanceResponse>;
  getScheduledTransactionDetails(scheduleId: string): Promise<ScheduledTransactionDetailsResponse>;
}
