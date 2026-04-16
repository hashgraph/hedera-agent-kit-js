import { AccountId, Hbar } from '@hiero-ledger/sdk';
import Long from 'long';

/**
 * The implementation from @hiero-ledger/sdk is not correctly exported, so a local definition of the type is needed
 */
export type TransferHbarInput = {
  accountId: AccountId | string;
  amount: number | string | Long | Hbar;
};

/**
 * The implementation of TokenTransfer from @hiero-ledger/sdk is not correctly exported, so a local definition of the type is needed
 */
export type TokenTransferMinimalParams = {
  tokenId: string;
  accountId: AccountId | string;
  amount: Long | number;
};
