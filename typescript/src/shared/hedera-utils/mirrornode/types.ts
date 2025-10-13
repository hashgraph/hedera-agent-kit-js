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

// Mirrors Hedera Mirror Node /topics/{topicId} response shape (fields optional to be resilient)
export type TopicInfo = {
  topic_id?: string;
  memo?: string | null;
  admin_key?: {
    _type?: string;
    key?: string;
  } | null;
  submit_key?: {
    _type?: string;
    key?: string;
  } | null;
  auto_renew_account?: string | null;
  auto_renew_period?: number | null;
  created_timestamp?: string | null;
  deleted?: boolean;
  sequence_number?: number | null;
  running_hash?: string | null;
  running_hash_version?: number | null;
};

export type TokenBalance = {
  automatic_association: boolean;
  created_timestamp: string;
  token_id: string;
  freeze_status: string;
  kyc_status: string;
  balance: number;
  decimals: number;
  symbol: string;
};

export type TokenBalancesResponse = {
  tokens: TokenBalance[];
};

export type NftBalance = {
  account_id: string;
  created_timestamp: string;
  delegating_spender: string | null;
  deleted: boolean;
  metadata: string;
  modified_timestamp: string;
  serial_number: number;
  spender: string | null;
  token_id: string;
};

export type NftBalanceResponse = {
  nfts: NftBalance[];
  links: {
    next: string | null;
  };
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

export type TransferData = {
  account: string;
  amount: number;
  is_approval: boolean;
};

export type TransactionData = {
  batch_key: string | null;
  bytes: string | null;
  charged_tx_fee: number;
  consensus_timestamp: string;
  entity_id: string;
  max_fee: string;
  max_custom_fees: any[];
  memo_base64: string;
  name: string;
  nft_transfers: any[];
  node: string;
  nonce: number;
  parent_consensus_timestamp: string | null;
  result: string;
  scheduled: boolean;
  staking_reward_transfers: any[];
  token_transfers: any[];
  transaction_hash: string;
  transaction_id: string;
  transfers: TransferData[];
  valid_duration_seconds: string;
  valid_start_timestamp: string;
};

export type TransactionDetailsResponse = {
  transactions: TransactionData[];
};

export interface ContractInfo {
  admin_key?: {
    description?: string;
    _type?: string;
    example?: string;
    key?: string;
  } | null;

  auto_renew_account?: string | null;
  auto_renew_period?: number | null;
  contract_id?: string | null;
  created_timestamp?: string | null;
  deleted?: boolean;
  evm_address?: string;
  expiration_timestamp?: string | null;
  file_id?: string | null;
  max_automatic_token_associations?: number | null;
  memo?: string;
  nonce?: number | null;
  obtainer_id?: string | null;
  permanent_removal?: boolean | null;
  proxy_account_id?: string | null;

  timestamp?: {
    description?: string;
    from: string;
    to?: string | null;
  };
}

export type ExchangeRate = {
  hbar_equivalent: number;
  cent_equivalent: number;
  expiration_time: number;
};

export type ExchangeRateResponse = {
  current_rate: ExchangeRate;
  next_rate: ExchangeRate;
  timestamp: string;
};

export interface TokenAirdropsResponse {
  airdrops: TokenAirdrop[];
  links: Links;
}

export interface TokenAirdrop {
  amount: number;
  receiver_id: string | null;
  sender_id: string | null;
  serial_number: number | null;
  timestamp: TimestampRange;
  token_id: string | null;
}

export interface TimestampRange {
  from: string;
  to: string | null;
}

export interface Links {
  next: string | null;
}

export interface TokenAllowanceResponse {
  allowances: TokenAllowance[];
  links: {
    next: string | null;
  };
}

export interface TokenAllowance {
  amount: number;
  amount_granted: number;
  owner: string; // e.g. "0.0.6941870"
  spender: string; // e.g. "0.0.6941872"
  timestamp: {
    from: string; // Hedera consensus timestamp, e.g. "1759488103.097757000"
    to: string | null;
  };
  token_id: string; // e.g. "0.0.6941871"
}

export interface ScheduledTransactionDetailsResponse {
  admin_key?: {
    _type?: string;
    key?: string;
  } | null;
  deleted: boolean;
  consensus_timestamp: string;
  creator_account_id: string;
  executed_timestamp: string | null;
  expiration_time: string | null;
  memo: string;
  payer_account_id: string;
  schedule_id: string;
  signatures: Array<{
    consensus_timestamp: string;
    public_key_prefix: string;
    signature: string;
    type: string;
  }>;
  transaction_body: string;
  wait_for_expiry: boolean;
}
