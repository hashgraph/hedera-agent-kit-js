import { LedgerId } from '@hiero-ledger/sdk';
import { IHederaMirrornodeService } from '@/shared';
import {
  AccountAPIResponse,
  AccountResponse,
  LedgerIdToBaseUrl,
  TokenBalancesResponse,
  TokenInfo,
  TopicInfo,
  TopicMessage,
  TopicMessagesAPIResponse,
  TopicMessagesQueryParams,
  TopicMessagesResponse,
  TransactionDetailsResponse,
  ContractInfo,
  TokenAirdropsResponse,
  ExchangeRateResponse,
  TokenAllowanceResponse,
  NftBalanceResponse,
  ScheduledTransactionDetailsResponse,
} from './types';
import BigNumber from 'bignumber.js';

// Function selector of ERC20 `decimals()`
const ERC20_DECIMALS_SELECTOR = '0x313ce567';

export class HederaMirrornodeServiceDefaultImpl implements IHederaMirrornodeService {
  private readonly baseUrl: string;

  constructor(private readonly ledgerId: LedgerId) {
    if (!LedgerIdToBaseUrl.has(ledgerId.toString())) {
      throw new Error(`Network type ${ledgerId} not supported`);
    }
    this.baseUrl = LedgerIdToBaseUrl.get(ledgerId.toString())!;
  }

  /**
   * Fetches JSON from the mirror node, retrying only on 404 with exponential
   * backoff. A just-created entity (transaction, token, topic, ...) is not
   * indexed for a few seconds and returns 404, so a read fired right after the
   * write would otherwise fail. Non-404 statuses throw immediately; an
   * exhausted 404 throws via `buildError`.
   */
  private async fetchJson<T>(
    url: string,
    buildError: (response: Response) => string,
    init?: RequestInit,
  ): Promise<T> {
    const maxAttempts = 3;
    let delayMs = 1000;
    for (let attempt = 1; ; attempt++) {
      const response = await fetch(url, init);

      if (response.ok) {
        return (await response.json()) as T;
      }

      if (response.status === 404 && attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
        delayMs *= 2;
        continue;
      }

      throw new Error(buildError(response));
    }
  }

  async getAccount(accountId: string): Promise<AccountResponse> {
    const url = `${this.baseUrl}/accounts/${accountId}`;
    const data = await this.fetchJson<AccountAPIResponse>(
      url,
      r => `Failed to fetch account ${accountId}: ${r.status} ${r.statusText}`,
    );

    // Check if the response is empty (no account found)
    if (!data.account) {
      throw new Error(`Account ${accountId} not found`);
    }

    return {
      accountId: data.account,
      accountPublicKey: data?.key?.key,
      balance: data.balance,
      evmAddress: data.evm_address,
      ethereumNonce: data.ethereum_nonce,
      createdTimestamp: data.created_timestamp,
      memo: data.memo,
      maxAutomaticTokenAssociations: data.max_automatic_token_associations,
      deleted: data.deleted,
    };
  }

  async getAccountHbarBalance(accountId: string): Promise<BigNumber> {
    let account;
    try {
      account = await this.getAccount(accountId);
    } catch (error) {
      throw Error(`Failed to fetch hbar balance for ${accountId}: ${error}`);
    }
    return new BigNumber(account.balance.balance);
  }

  async getAccountTokenBalances(
    accountId: string,
    tokenId?: string,
  ): Promise<TokenBalancesResponse> {
    const tokenIdParam = tokenId ? `&token.id=${tokenId}` : '';
    const url = `${this.baseUrl}/accounts/${accountId}/tokens?${tokenIdParam}`;
    const res = await this.fetchJson<any>(
      url,
      r => `Failed to fetch balance for account ${accountId}: ${r.status} ${r.statusText}`,
    );

    // Fetch and attach symbols in parallel
    await Promise.all(
      res.tokens.map(async (balance: any) => {
        try {
          const tokenInfo = await this.getTokenInfo(balance.token_id);
          balance.symbol = tokenInfo.symbol;
        } catch (err) {
          console.warn(`Failed to fetch token info for ${balance.token_id}:`, err);
          balance.symbol = 'UNKNOWN';
        }
      }),
    );

    return res;
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
        const data: TopicMessagesAPIResponse = await this.fetchJson<TopicMessagesAPIResponse>(
          url,
          r => `Failed to get topic messages for ${queryParams.topicId}: ${r.status} ${r.statusText}`,
        );

        arrayOfMessages.push(...data.messages);
        if (fetchedMessages >= 100) {
          break;
        }

        // Update URL for pagination.
        // This endpoint does not return a full path to the next page, it has to be built first
        url = data.links.next ? this.baseUrl + data.links.next : null;
      }
    } catch (error) {
      console.error(`Failed to fetch topic messages for ${queryParams.topicId}. Error:`, error);
      throw error;
    }
    return {
      topicId: queryParams.topicId,
      messages: arrayOfMessages.slice(0, queryParams.limit),
    };
  }

  async getTokenInfo(tokenId: string): Promise<TokenInfo> {
    const url = `${this.baseUrl}/tokens/${tokenId}`;
    return this.fetchJson<TokenInfo>(
      url,
      r => `Failed to get token info for a token ${tokenId}: ${r.status} ${r.statusText}`,
    );
  }

  async getTopicInfo(topicId: string): Promise<TopicInfo> {
    const url = `${this.baseUrl}/topics/${topicId}`;
    return this.fetchJson<TopicInfo>(
      url,
      r => `Failed to get topic info for ${topicId}: ${r.status} ${r.statusText}`,
    );
  }

  async getTransactionRecord(
    transactionId: string,
    nonce?: number,
  ): Promise<TransactionDetailsResponse> {
    let url = `${this.baseUrl}/transactions/${transactionId}`;
    if (nonce !== undefined) {
      url += `?nonce=${nonce}`;
    }
    return this.fetchJson<TransactionDetailsResponse>(
      url,
      r => `Failed to get transaction record for ${transactionId}: ${r.status} ${r.statusText}`,
    );
  }

  async getContractInfo(contractId: string): Promise<ContractInfo> {
    const url = `${this.baseUrl}/contracts/${contractId}`;
    return this.fetchJson<ContractInfo>(
      url,
      r => `Failed to get contract info for ${contractId}: ${r.status} ${r.statusText}`,
    );
  }

  /**
   * Reads the `decimals()` value of an ERC20 contract via the mirror node
   * read-only `/contracts/call` endpoint.
   */
  async getERC20Decimals(contractId: string): Promise<number> {
    const contractInfo = await this.getContractInfo(contractId);
    const { result } = await this.fetchJson<{ result: string }>(
      `${this.baseUrl}/contracts/call`,
      r => `Failed to read decimals of ERC20 contract ${contractId}: ${r.status} ${r.statusText}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: ERC20_DECIMALS_SELECTOR, to: contractInfo.evm_address }),
      },
    );
    return Number(BigInt(result));
  }

  async getPendingAirdrops(accountId: string): Promise<TokenAirdropsResponse> {
    const url = `${this.baseUrl}/accounts/${accountId}/airdrops/pending`;
    return this.fetchJson<TokenAirdropsResponse>(
      url,
      r => `Failed to fetch pending airdrops for an account ${accountId}: ${r.status} ${r.statusText}`,
    );
  }

  async getOutstandingAirdrops(accountId: string): Promise<TokenAirdropsResponse> {
    const url = `${this.baseUrl}/accounts/${accountId}/airdrops/outstanding`;
    return this.fetchJson<TokenAirdropsResponse>(
      url,
      r =>
        `Failed to fetch outstanding airdrops for an account ${accountId}: ${r.status} ${r.statusText}`,
    );
  }

  async getExchangeRate(timestamp?: string): Promise<ExchangeRateResponse> {
    const timestampParam = timestamp ? `?timestamp=${encodeURIComponent(timestamp)}` : '';
    const url = `${this.baseUrl}/network/exchangerate${timestampParam}`;
    return this.fetchJson<ExchangeRateResponse>(
      url,
      r => `HTTP error! status: ${r.status}. Message: ${r.statusText}`,
    );
  }

  async getTokenAllowances(
    ownerAccountId: string,
    spenderAccountId: string,
  ): Promise<TokenAllowanceResponse> {
    const url = `${this.baseUrl}/accounts/${ownerAccountId}/allowances/tokens?spender.id=${spenderAccountId}`;
    return this.fetchJson<TokenAllowanceResponse>(
      url,
      r => `HTTP error! status: ${r.status}. Message: ${r.statusText}`,
    );
  }

  async getAccountNfts(ownerAccountId: string): Promise<NftBalanceResponse> {
    const url = `${this.baseUrl}/accounts/${ownerAccountId}/nfts`;
    return this.fetchJson<NftBalanceResponse>(
      url,
      r => `HTTP error! status: ${r.status}. Message: ${r.statusText}`,
    );
  }

  async getScheduledTransactionDetails(
    scheduleId: string,
  ): Promise<ScheduledTransactionDetailsResponse> {
    const url = `${this.baseUrl}/schedules/${scheduleId}`;
    return this.fetchJson<ScheduledTransactionDetailsResponse>(
      url,
      r => `HTTP error! status: ${r.status}. Message: ${r.statusText}`,
    );
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }
}
