import { Context } from '@/shared';
import { z } from 'zod';
import { AccountId, Key, Timestamp } from '@hashgraph/sdk';

export const optionalScheduledTransactionParams = (_context: Context = {}) =>
  z.object({
    schedulingParams: z
      .object({
        isScheduled: z
          .boolean()
          .optional()
          .default(false)
          .describe(
            'If true, the transaction will be created as a scheduled transaction instead of executing immediately. Other params will be ignored if this is false or omitted.',
          ),
        scheduleTransactionMemo: z
          .string()
          .max(100)
          .optional()
          .describe('Optional memo to attach to the scheduled transaction (max 100 characters).'),
        adminKey: z
          .union([z.boolean(), z.string()])
          .optional()
          .default(false)
          .describe(
            'Optional admin key that can delete or modify the scheduled transaction before execution. If true is passed, the operator key will be used. If false or omitted, the key wont be set. If a string is passed, it will be used as the admin key.',
          ),
        payerAccountId: z
          .string()
          .optional()
          .describe(
            'Account ID that will pay the transaction fee when the scheduled transaction executes. Defaults to the operator if omitted.',
          ),
        expirationTime: z
          .string()
          .optional()
          .describe(
            'Optional ISO 8601 timestamp (string) specifying when the scheduled transaction will expire if it is not fully signed.',
          ),
        waitForExpiry: z
          .boolean()
          .optional()
          .default(false)
          .describe(
            'If true, the schedule entity remains on the ledger until expiry even after execution.',
          ),
      })
      .describe(
        'Optional scheduling parameters. Used to control whether the transaction should be scheduled, provide metadata, control payer/admin keys, and manage execution/expiration behavior.',
      ),
  });

export const optionalScheduledTransactionParamsNormalised = z.object({
  isScheduled: z
    .boolean()
    .describe(
      'If true, the transaction will be created as a scheduled transaction. If false or omitted, all other scheduling parameters will be ignored.',
    ),
  scheduleMemo: z
    .string()
    .optional()
    .describe('Optional memo attached to the scheduled transaction (max 100 characters).'),
  adminKey: z
    .instanceof(Key)
    .optional()
    .describe(
      'Admin key that can delete or modify the scheduled transaction before execution. Can be undefined if not set.',
    ),
  payerAccountID: z
    .instanceof(AccountId)
    .optional()
    .describe(
      'Account that will pay the transaction fee when the scheduled transaction executes. Defaults to operator if undefined.',
    ),
  expirationTime: z
    .instanceof(Timestamp)
    .optional()
    .describe(
      'Time when the scheduled transaction will expire if not fully signed (ISO 8601 converted to Timestamp).',
    ),
  waitForExpiry: z
    .boolean()
    .describe(
      'If true, keeps the schedule entity on the ledger until expiry even after execution.',
    ),
});
