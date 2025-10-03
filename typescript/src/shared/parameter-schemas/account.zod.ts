import { Context } from '@/shared/configuration';
import { z } from 'zod';
import { AccountId, Hbar, Key, Transaction, HbarAllowance } from '@hashgraph/sdk';
import BigNumber from 'bignumber.js';
import Long from 'long';

export const transferHbarParameters = (_context: Context = {}) =>
  z.object({
    transfers: z
      .array(
        z.object({
          accountId: z.string().describe('Recipient account ID'),
          amount: z.number().describe('Amount of HBAR to transfer'),
        }),
      )
      .describe('Array of HBAR transfers'),
    sourceAccountId: z.string().optional().describe('Sender account ID'),
    transactionMemo: z.string().optional().describe('Memo to include with the transaction'),
  });

export const transferHbarParametersNormalised = (_context: Context = {}) =>
  z.object({
    hbarTransfers: z.array(
      z.object({
        accountId: z.union([z.string(), z.instanceof(AccountId)]),
        amount: z.union([
          z.number(),
          z.string(),
          z.instanceof(Hbar),
          z.instanceof(Long),
          z.instanceof(BigNumber),
        ]),
      }),
    ),
    transactionMemo: z.string().optional(),
  });

export const createAccountParameters = (_context: Context = {}) =>
  z.object({
    publicKey: z
      .string()
      .optional()
      .describe('Account public key. If not provided, a public key of the operator will be used'),
    accountMemo: z.string().optional().describe('Optional memo for the account'),
    initialBalance: z
      .number()
      .optional()
      .default(0)
      .describe('Initial HBAR balance to fund the account (defaults to 0)'),
    maxAutomaticTokenAssociations: z
      .number()
      .optional()
      .default(-1)
      .describe('Max automatic token associations (-1 for unlimited)'),
  });

export const createAccountParametersNormalised = (_context: Context = {}) =>
  z.object({
    accountMemo: z.string().optional(),
    initialBalance: z.union([z.string(), z.number()]).optional(),
    key: z.instanceof(Key).optional(),
    maxAutomaticTokenAssociations: z.union([z.number(), z.instanceof(Long)]).optional(),
  });

export const deleteAccountParameters = (_context: Context = {}) =>
  z.object({
    accountId: z.string().describe('The account ID to delete.'),
    transferAccountId: z
      .string()
      .optional()
      .describe(
        'The ID of the account to transfer the remaining funds to. If not provided, the operator account ID will be used.',
      ),
  });

export const deleteAccountParametersNormalised = (_context: Context = {}) =>
  z.object({
    accountId: z.instanceof(AccountId),
    transferAccountId: z.instanceof(AccountId),
  });

export const updateAccountParameters = (_context: Context = {}) =>
  z.object({
    // If not passed, will be injected from context in normalisation
    accountId: z
      .string()
      .optional()
      .describe(
        'Account ID to update (e.g., 0.0.xxxxx). If not provided, operator account ID will be used',
      ),

    maxAutomaticTokenAssociations: z
      .number()
      .int()
      .optional()
      .describe('Max automatic token associations, positive, zero or -1 if unlimited'),
    stakedAccountId: z.string().optional().describe('Staked account ID'),
    accountMemo: z.string().optional().describe('Account memo'),
    declineStakingReward: z.boolean().optional().describe('Decline staking rewards'),
  });

export const updateAccountParametersNormalised = (_context: Context = {}) =>
  z.object({
    accountId: z.instanceof(AccountId),
    maxAutomaticTokenAssociations: z.union([z.number(), z.instanceof(Long)]).optional(),
    stakedAccountId: z.union([z.string(), z.instanceof(AccountId)]).optional(),
    accountMemo: z.string().optional(),
    declineStakingReward: z.boolean().optional(),
  });

export const accountQueryParameters = (_context: Context = {}) =>
  z.object({
    accountId: z.string().describe('The account ID to query.'),
  });

export const accountBalanceQueryParameters = (_context: Context = {}) =>
  z.object({
    accountId: z.string().optional().describe('The account ID to query.'),
  });

export const accountTokenBalancesQueryParameters = (_context: Context = {}) =>
  z.object({
    accountId: z
      .string()
      .optional()
      .describe('The account ID to query. If not provided, this accountId will be used.'),
    tokenId: z.string().optional().describe('The token ID to query.'),
  });

export const signScheduleTransactionParameters = (_context: Context = {}) =>
  z.object({
    scheduleId: z.string().describe('The ID of the scheduled transaction to sign'),
  });

export const createScheduleTransactionParametersNormalised = (_context: Context = {}) =>
  z.object({
    scheduledTransaction: z.instanceof(Transaction),
    params: z.object({
      scheduleMemo: z.string().optional(),
      adminKey: z.instanceof(Key).optional(),
    }),
  });

export const scheduleDeleteTransactionParameters = (_context: Context = {}) =>
  z.object({
    scheduleId: z.string().describe('The ID of the scheduled transaction to delete'),
  });

export const approveHbarAllowanceParameters = (_context: Context = {}) =>
  z.object({
    ownerAccountId: z
      .string()
      .optional()
      .describe('Owner account ID (defaults to operator account ID if omitted)'),
    spenderAccountId: z.string().describe('Spender account ID'),
    amount: z
      .number()
      .describe('Amount of HBAR to approve as allowance (can be decimal, not negative)'),
    transactionMemo: z.string().optional().describe('Memo to include with the transaction'),
  });

export const approveHbarAllowanceParametersNormalised = (_context: Context = {}) =>
  z.object({
    hbarApprovals: z.array(z.instanceof(HbarAllowance)).optional(),
    transactionMemo: z.string().optional(),
  });

export const deleteHbarAllowanceParameters = (_context: Context = {}) =>
  z.object({
    ownerAccountId: z
      .string()
      .optional()
      .describe('Owner account ID (defaults to operator account ID if omitted)'),
    spenderAccountId: z.string().describe('Spender account ID'),
    transactionMemo: z.string().optional().describe('Memo to include with the transaction'),
  });

export const deleteHbarAllowanceParametersNormalised = (_context: Context = {}) =>
  z.object({
    hbarAllowances: z.array(z.instanceof(HbarAllowance)).optional(),
    transactionMemo: z.string().optional(),
  });
