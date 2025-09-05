import {
  TopicMessagesQueryParams,
  AccountResponse,
  TokenBalancesResponse,
  TopicMessagesResponse,
  TokenInfo,
  TransactionDetailsResponse,
  ContractInfo,
} from './types';

export interface IHederaMirrornodeService {
  getAccount(accountId: string): Promise<AccountResponse>;
  getAccountHBarBalance(accountId: string): Promise<BigNumber>;
  getAccountTokenBalances(accountId: string): Promise<TokenBalancesResponse>;
  getTopicMessages(queryParams: TopicMessagesQueryParams): Promise<TopicMessagesResponse>;
  getTokenInfo(tokenId: string): Promise<TokenInfo>;
  getContractInfo(contractId: string): Promise<ContractInfo>;
  getTransactionRecord(transactionId: string, nonce?: number): Promise<TransactionDetailsResponse>;
}
