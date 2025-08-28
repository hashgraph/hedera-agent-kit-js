import { LedgerId } from '@hashgraph/sdk';
import { IHederaMirrornodeService } from './hedera-mirrornode-service.interface';
import {
  AccountAPIResponse,
  AccountResponse,
  LedgerIdToBaseUrl,
  TokenBalancesResponse,
  TokenInfo,
  TopicMessage,
  TopicMessagesAPIResponse,
  TopicMessagesQueryParams,
  TopicMessagesResponse,
} from './types';
import BigNumber from 'bignumber.js';

export class HederaMirrornodeServiceDefaultImpl implements IHederaMirrornodeService {
  private readonly baseUrl: string;

  constructor(private readonly ledgerId: LedgerId) {
    if (!LedgerIdToBaseUrl.has(ledgerId.toString())) {
      throw new Error(`Network type ${ledgerId} not supported`);
    }
    this.baseUrl = LedgerIdToBaseUrl.get(ledgerId.toString())!;
  }

  async getAccount(accountId: string): Promise<AccountResponse> {
    const url = `${this.baseUrl}/accounts/${accountId}`;
    const response = await fetch(url);
    const data: AccountAPIResponse = await response.json();
    return {
      accountId: data.account,
      accountPublicKey: data?.key?.key,
      balance: data.balance,
      evmAddress: data.evm_address,
    };
  }

  async getAccountHBarBalance(accountId: string): Promise<BigNumber> {
    const account = await this.getAccount(accountId);
    return new BigNumber(account.balance.balance);
  }

  async getAccountTokenBalances(
    accountId: string,
    tokenId?: string,
  ): Promise<TokenBalancesResponse> {
    const tokenIdParam = tokenId ? `&token.id=${tokenId}` : '';
    const url = `${this.baseUrl}/accounts/${accountId}/tokens?${tokenIdParam}`;
    const response = await fetch(url);
    return await response.json();
  }

  async getTopicMessages(queryParams: TopicMessagesQueryParams): Promise<TopicMessagesResponse> {
    const lowerThreshold = queryParams.lowerTimestamp
      ? `&timestamp=gte:${queryParams.lowerTimestamp}`
      : '';
    const upperThreshold = queryParams.upperTimestamp
      ? `&timestamp=lte:${queryParams.upperTimestamp}`
      : '';
    const baseParams = `&order=desc&limit=100`;
    let url: string | null =
      `${this.baseUrl}/topics/${queryParams.topicId}/messages?${lowerThreshold}${upperThreshold}${baseParams}`;
    const arrayOfMessages: TopicMessage[] = [];
    let fetchedMessages = 0;
    try {
      while (url) {
        // Results are paginated

        fetchedMessages += 1;
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(
            `HTTP error! status: ${response.status}. Message: ${response.statusText}`,
          );
        }

        const data: TopicMessagesAPIResponse = await response.json();

        arrayOfMessages.push(...data.messages);
        if (fetchedMessages >= 100) {
          break;
        }

        // Update URL for pagination.
        // This endpoint does not return a full path to the next page, it has to be built first
        url = data.links.next ? this.baseUrl + data.links.next : null;
      }
    } catch (error) {
      console.error('Failed to fetch topic messages. Error:', error);
      throw error;
    }
    return {
      topicId: queryParams.topicId,
      messages: arrayOfMessages.slice(0, queryParams.limit),
    };
  }

  async getTokenInfo(tokenId: string): Promise<TokenInfo> {
    const url = `${this.baseUrl}/tokens/${tokenId}`;
    const response = await fetch(url);
    return await response.json();
  }
}
