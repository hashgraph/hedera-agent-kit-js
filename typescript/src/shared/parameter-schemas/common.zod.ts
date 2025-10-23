import { Context } from '@/shared';
import { z } from 'zod';
import { AccountId, PublicKey, Timestamp } from '@hashgraph/sdk';

export const optionalScheduledTransactionParams = (_context: Context = {}) =>
  z.object({
    schedulingParams: z
      .object({
        isScheduled: z
          .boolean()
          .optional()
          .default(false)
          .describe(
            'If true, the transaction will be created as a scheduled transaction. If false or omitted, all other scheduling parameters will be ignored.',
          ),
        adminKey: z
          .union([z.boolean(), z.string()])
          .optional()
          .default(false)
          .describe(
            'Admin key that can delete or modify the scheduled transaction before execution. If true, the operator key will be used. If false or omitted, no admin key is set. If a string is passed, it will be used as the admin key.',
          ),
        payerAccountId: z
          .string()
          .optional()
          .describe(
            'Account that will pay the transaction fee when the scheduled transaction executes. Defaults to the ${AccountResolver.getDefaultAccountDescription(context)}.',
          ),
        expirationTime: z
          .string()
          .optional()
          .describe(
            'Time when the scheduled transaction will expire if not fully signed (ISO 8601 format).',
          ),
        waitForExpiry: z
          .boolean()
          .optional()
          .default(false)
          .describe(
            'Determines when the scheduled transaction executes:\n' +
              '- `false` (default): execute as soon as all required signatures are collected.\n' +
              '- `true`: execute at the scheduled expiration time, regardless of signatures.\n' +
              'Requires `expirationTime` to be set if true; otherwise an error is thrown.\n' +
              'Set to true only if the user explicitly requests execution at expiration.',
          ),
      })
      .optional()
      .describe(
        'Optional scheduling parameters. Used to control whether the transaction should be scheduled, provide metadata, control payer/admin keys, and manage execution/expiration behavior.',
      ),
  });

export const optionalScheduledTransactionParamsNormalised = (_context: Context) =>
  z.object({
    schedulingParams: z
      .object({
        isScheduled: z.boolean(),
        adminKey: z.instanceof(PublicKey).optional(),
        payerAccountID: z.instanceof(AccountId).optional(),
        expirationTime: z.instanceof(Timestamp).optional(),
        waitForExpiry: z.boolean().optional(),
      })
      .optional(),
  });
