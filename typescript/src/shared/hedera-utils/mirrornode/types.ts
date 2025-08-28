import { LedgerId } from '@hashgraph/sdk';
import BigNumber from 'bignumber.js';

export const LedgerIdToBaseUrl: Map<string, string> = new Map([
  [LedgerId.MAINNET.toString(), 'https://mainnet-public.mirrornode.hedera.com/api/v1'],
  [LedgerId.TESTNET.toString(), 'https://testnet.mirrornode.hedera.com/api/v1'],
]);

export type AccountTokenBalancesQueryParams = {
  accountId: string;
  tokenId?: string;
};

export type TopicMessagesQueryParams = {
  topicId: string;
  lowerTimestamp: string;
  upperTimestamp: string;
  limit: number;
};

export type TopicMessage = {
  topicId: string;
  message: string;
  consensus_timestamp: string;
};

export type TopicMessagesResponse = {
  topicId: string;
  messages: TopicMessage[];
};

export type TokenBalance = {
  automatic_association: boolean;
  created_timestamp: string;
  token_id: string;
  freeze_status: string;
  kyc_status: string;
  balance: number;
  decimals: number;
};

export type TokenBalancesResponse = {
  tokens: TokenBalance[];
};

export type AccountResponse = {
  accountId: string;
  accountPublicKey: string;
  balance: AccountBalanceResponse;
  evmAddress: string;
};

export type AccountAPIResponse = {
  account: string;
  key: {
    key: string;
    _type: KeyEncryptionType;
  };
  balance: AccountBalanceResponse;
  evm_address: string;
};

export type AccountBalanceResponse = {
  balance: BigNumber;
  timestamp: string;
  tokens: TokenBalance[];
};

export type TopicMessagesAPIResponse = {
  messages: TopicMessage[];
  links: {
    next: string | null;
  };
};

export type KeyEncryptionType = 'ED25519' | 'ECDSA_SECP256K1';

/**
 * This type matches responses from Hedera Mirror Node API
 */
export type TokenInfo = {
  // Basic Token Identity
  token_id?: string;
  name: string;
  symbol: string;
  type?: string;
  memo?: string;

  // Supply Information
  decimals: string;
  initial_supply?: string;
  total_supply?: string;
  max_supply?: string;
  supply_type?: string;

  // Account & Treasury
  treasury_account_id?: string;
  auto_renew_account?: string;
  auto_renew_period?: number;

  // Status & State
  deleted: boolean;
  freeze_default?: boolean;
  pause_status?: string;

  // Timestamps
  created_timestamp?: string;
  modified_timestamp?: string;
  expiry_timestamp?: number;

  // Keys
  admin_key?: {
    _type: string;
    key: string;
  } | null;
  supply_key?: {
    _type: string;
    key: string;
  } | null;
  kyc_key?: {
    _type: string;
    key: string;
  } | null;
  freeze_key?: {
    _type: string;
    key: string;
  } | null;
  wipe_key?: {
    _type: string;
    key: string;
  } | null;
  pause_key?: {
    _type: string;
    key: string;
  } | null;
  fee_schedule_key?: {
    _type: string;
    key: string;
  } | null;
  metadata_key?: {
    _type: string;
    key: string;
  } | null;

  // Metadata & Custom Features
  metadata?: string;
  custom_fees?: {
    created_timestamp: string;
    fixed_fees: any[];
    fractional_fees: any[];
  };
};
