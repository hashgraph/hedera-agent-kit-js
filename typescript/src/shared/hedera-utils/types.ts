import { AccountId, Hbar } from '@hashgraph/sdk';
import BigNumber from 'bignumber.js';
import Long from 'long';

/**
 * The implementation from @hashgraph/sdk is not correctly exported, so a local definition of the type is needed
 */
export type TransferHbarInput = {
  accountId: AccountId | string;
  amount: number | string | Long | BigNumber | Hbar;
};

/**
 * The implementation of TokenTransfer from @hashgraph/sdk is not correctly exported, so a local definition of the type is needed
 */
export type TokenTransferMinimalParams = {
  tokenId: string;
  accountId: AccountId | string;
  amount: Long | number;
};
