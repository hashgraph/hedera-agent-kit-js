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
} from './types';

export interface IHederaMirrornodeService {
  getAccount(accountId: string): Promise<AccountResponse>;
  getAccountHBarBalance(accountId: string): Promise<BigNumber>;
  getAccountTokenBalances(accountId: string): Promise<TokenBalancesResponse>;
  getTopicMessages(queryParams: TopicMessagesQueryParams): Promise<TopicMessagesResponse>;
  getTopicInfo(topicId: string): Promise<TopicInfo>;
  getTokenInfo(tokenId: string): Promise<TokenInfo>;
  getContractInfo(contractId: string): Promise<ContractInfo>;
  getTransactionRecord(transactionId: string, nonce?: number): Promise<TransactionDetailsResponse>;
  getExchangeRate(timestamp?: string): Promise<ExchangeRateResponse>;
  getPendingAirdrops(accountId: string): Promise<TokenAirdropsResponse>;
  getOutstandingAirdrops(accountId: string): Promise<TokenAirdropsResponse>;
}
