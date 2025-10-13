import { Context } from '@/shared/configuration';
import { z } from 'zod';
import {
  AccountId,
  NftId,
  PublicKey,
  TokenId,
  TokenNftAllowance,
  TokenSupplyType,
  TokenType,
} from '@hashgraph/sdk';
import { TokenTransferMinimalParams } from '@/shared/hedera-utils/types';
import {
  optionalScheduledTransactionParams,
  optionalScheduledTransactionParamsNormalised,
} from '@/shared/parameter-schemas/common.zod';

export const createFungibleTokenParameters = (_context: Context = {}) =>
  optionalScheduledTransactionParams(_context).extend({
    tokenName: z.string().describe('The name of the token.'),
    tokenSymbol: z.string().describe('The symbol of the token.'),
    initialSupply: z
      .number()
      .int()
      .optional()
      .default(0)
      .describe('The initial supply of the token.'),
    supplyType: z
      .enum(['finite', 'infinite'])
      .optional()
      .default('finite')
      .describe('Supply type of the token.'),
    maxSupply: z.number().int().optional().describe('The maximum supply of the token.'),
    decimals: z.number().int().optional().default(0).describe('The number of decimals.'),
    treasuryAccountId: z.string().optional().describe('The treasury account of the token.'),
    isSupplyKey: z
      .boolean()
      .optional()
      .describe('Determines if the token supply key should be set.'),
  });

export const createFungibleTokenParametersNormalised = (_context: Context = {}) =>
  optionalScheduledTransactionParamsNormalised(_context).merge(
    createFungibleTokenParameters(_context)
      .omit({ schedulingParams: true })
      .extend({
        treasuryAccountId: z.string().describe('The treasury account of the token.'),
        autoRenewAccountId: z
          .string()
          .optional()
          .describe(
            'The auto renew account for the token. If not provided, defaults to the operator account.',
          ),
        supplyKey: z
          .custom<PublicKey>()
          .optional()
          .describe('The supply key. If not provided, defaults to the operator’s public key.'),
        supplyType: z.custom<TokenSupplyType>().describe('Supply type of the token.'),
        adminKey: z.custom<PublicKey>().optional().describe('The admin key for the token.'),
        kycKey: z.custom<PublicKey>().optional().describe('The KYC key for the token.'),
        freezeKey: z.custom<PublicKey>().optional().describe('The freeze key for the token.'),
        wipeKey: z.custom<PublicKey>().optional().describe('The wipe key for the token.'),
        pauseKey: z.custom<PublicKey>().optional().describe('The pause key for the token.'),
        metadataKey: z.custom<PublicKey>().optional().describe('The metadata key for the token.'),
        tokenMemo: z.string().optional().describe('The memo for the token.'),
        tokenType: z.custom<TokenType>().optional().describe('The type of the token.'),
      }),
  );

export const createNonFungibleTokenParameters = (_context: Context = {}) =>
  optionalScheduledTransactionParams(_context).extend({
    tokenName: z.string().describe('The name of the token.'),
    tokenSymbol: z.string().describe('The symbol of the token.'),
    maxSupply: z
      .number()
      .int()
      .optional()
      .default(100)
      .describe('The maximum supply of the token.'),
    treasuryAccountId: z.string().optional().describe('The treasury account of the token.'),
  });

export const createNonFungibleTokenParametersNormalised = (_context: Context = {}) =>
  createNonFungibleTokenParameters(_context)
    .omit({ schedulingParams: true }) // remove unnormalized scheduling params
    .merge(optionalScheduledTransactionParamsNormalised(_context)) // add normalized ones
    .extend({
      autoRenewAccountId: z
        .string()
        .describe(
          'The auto renew account for the token. If not provided, defaults to the operator account.',
        ),
      supplyKey: z
        .custom<PublicKey>()
        .describe('The supply key. If not provided, defaults to the operator’s public key.'),
      supplyType: z
        .custom<TokenSupplyType>()
        .default(TokenSupplyType.Finite)
        .describe('Supply type of the token - must be finite for NFT.'),
      tokenType: z
        .custom<TokenType>()
        .default(TokenType.NonFungibleUnique)
        .describe('Token type of the token - must be non-fungible unique for NFT.'),
      adminKey: z.custom<PublicKey>().optional().describe('The admin key for the token.'),
      kycKey: z.custom<PublicKey>().optional().describe('The KYC key for the token.'),
      freezeKey: z.custom<PublicKey>().optional().describe('The freeze key for the token.'),
      wipeKey: z.custom<PublicKey>().optional().describe('The wipe key for the token.'),
      pauseKey: z.custom<PublicKey>().optional().describe('The pause key for the token.'),
      tokenMemo: z.string().optional().describe('The memo for the token.'),
    });

const AirdropRecipientSchema = z.object({
  accountId: z.string().describe('Recipient account ID (e.g., "0.0.xxxx").'),
  amount: z.union([z.number(), z.string()]).describe('Amount in base unit.'),
});

export const airdropFungibleTokenParameters = (_context: Context = {}) =>
  z.object({
    tokenId: z.string().describe('The id of the token.'),
    sourceAccountId: z.string().optional().describe('The account to airdrop the token from.'),
    recipients: z
      .array(AirdropRecipientSchema)
      .min(1)
      .describe('Array of recipient objects, each with accountId and amount.'),
  });

export const airdropFungibleTokenParametersNormalised = () =>
  z.object({
    tokenTransfers: z
      .custom<TokenTransferMinimalParams[]>()
      .describe('Array of TokenTransfer objects constructed from the original recipients.'),
  });

export const mintFungibleTokenParameters = (_context: Context = {}) =>
  optionalScheduledTransactionParams(_context).extend({
    tokenId: z.string().describe('The id of the token.'),
    amount: z.number().describe('The amount of tokens to mint.'),
  });

export const mintFungibleTokenParametersNormalised = (_context: Context = {}) =>
  mintFungibleTokenParameters(_context)
    .omit({ schedulingParams: true })
    .merge(optionalScheduledTransactionParamsNormalised(_context));

export const mintNonFungibleTokenParameters = (_context: Context = {}) =>
  optionalScheduledTransactionParams(_context).extend({
    tokenId: z.string().describe('The id of the NFT class.'),
    uris: z.array(z.string().max(100)).max(10).describe('An array of URIs hosting NFT metadata.'),
  });

export const mintNonFungibleTokenParametersNormalised = (_context: Context = {}) =>
  optionalScheduledTransactionParamsNormalised(_context).extend({
    tokenId: z.string().describe('The id of the NFT class.'),
    metadata: z
      .instanceof(Uint8Array<ArrayBufferLike>)
      .array()
      .optional(),
  });

export const deleteTokenParameters = (_context: Context = {}) =>
  z.object({
    tokenId: z.string().describe('The ID of the token to delete.'),
  });

export const deleteTokenParametersNormalised = (_context: Context = {}) =>
  deleteTokenParameters(_context).extend({});

export const tokenInfoQueryParameters = (_context: Context = {}) =>
  z.object({
    tokenId: z.string().optional().describe('The token ID to query.'),
  });

export const updateTokenParameters = (_context: Context = {}) =>
  z.object({
    tokenId: z.string().describe('The ID of the token to update (e.g., 0.0.12345).'),
    tokenDesc: z
      .string()
      .optional()
      .describe('Optional description of the token update operation.'),
    tokenName: z
      .string()
      .max(100)
      .optional()
      .describe('New name for the token. Up to 100 characters.'),
    tokenSymbol: z
      .string()
      .max(100)
      .optional()
      .describe('New symbol for the token. Up to 100 characters.'),
    treasuryAccountId: z
      .string()
      .optional()
      .describe('New treasury account for the token (Hedera account ID).'),
    adminKey: z
      .union([z.boolean(), z.string()])
      .optional()
      .describe(
        'New admin key. Pass boolean `true` to use the operator/user key, or provide a Hedera-compatible public key string. Required for most property updates.',
      ),
    kycKey: z
      .union([z.boolean(), z.string()])
      .optional()
      .describe(
        'New KYC key. Pass boolean `true` to use the operator/user key, or provide a public key string.',
      ),
    freezeKey: z
      .union([z.boolean(), z.string()])
      .optional()
      .describe(
        'New freeze key. Pass boolean `true` to use the operator/user key, or provide a public key string.',
      ),
    wipeKey: z
      .union([z.boolean(), z.string()])
      .optional()
      .describe(
        'New wipe key. Pass boolean `true` to use the operator/user key, or provide a public key string.',
      ),
    supplyKey: z
      .union([z.boolean(), z.string()])
      .optional()
      .describe(
        'New supply key. Pass boolean `true` to use the operator/user key, or provide a public key string.',
      ),
    feeScheduleKey: z
      .union([z.boolean(), z.string()])
      .optional()
      .describe(
        'New fee schedule key. Pass boolean `true` to use the operator/user key, or provide a public key string.',
      ),
    pauseKey: z
      .union([z.boolean(), z.string()])
      .optional()
      .describe(
        'New pause key. Pass boolean `true` to use the operator/user key, or provide a public key string.',
      ),
    metadataKey: z
      .union([z.boolean(), z.string()])
      .optional()
      .describe(
        'New metadata key. Pass boolean `true` to use the operator/user key, or provide a public key string.',
      ),
    metadata: z
      .string()
      .optional()
      .describe('New metadata for the token, in bytes (as base64 or hex).'),
    tokenMemo: z
      .string()
      .max(100)
      .optional()
      .describe('Short public memo for the token, up to 100 characters.'),
    autoRenewAccountId: z
      .string()
      .optional()
      .describe('Account to automatically pay for token renewal (Hedera account ID).'),
  });

export const updateTokenParametersNormalised = (_context: Context = {}) =>
  z.object({
    tokenId: z.instanceof(TokenId),

    // Strings
    tokenName: z.string().optional(),
    tokenSymbol: z.string().optional(),
    tokenMemo: z.string().optional(),
    metadata: z.instanceof(Uint8Array<ArrayBufferLike>).optional(),

    // IDs
    treasuryAccountId: z.union([z.string(), z.instanceof(AccountId)]).optional(),
    autoRenewAccountId: z.union([z.string(), z.instanceof(AccountId)]).optional(),

    // Keys
    adminKey: z.instanceof(PublicKey).optional(),
    supplyKey: z.instanceof(PublicKey).optional(),
    wipeKey: z.instanceof(PublicKey).optional(),
    freezeKey: z.instanceof(PublicKey).optional(),
    kycKey: z.instanceof(PublicKey).optional(),
    feeScheduleKey: z.instanceof(PublicKey).optional(),
    pauseKey: z.instanceof(PublicKey).optional(),
    metadataKey: z.instanceof(PublicKey).optional(),
  });

// Associate Token
export const associateTokenParameters = (_context: Context = {}) =>
  z.object({
    // If not passed, will be injected from context in normalisation
    accountId: z
      .string()
      .optional()
      .describe(
        'Account ID to associate tokens with (e.g., 0.0.xxxxx). If not provided, operator account ID will be used',
      ),
    // One or more token IDs to associate
    tokenIds: z.array(z.string()).min(1).describe('Array of token IDs to associate'),
  });

export const associateTokenParametersNormalised = (_context: Context = {}) =>
  z.object({
    accountId: z.string().describe('Resolved account ID to associate tokens with'),
    tokenIds: z.array(z.string()).min(1).describe('Array of token IDs to associate'),
  });

export const pendingAirdropQueryParameters = (_context: Context = {}) =>
  z.object({
    accountId: z.string().optional().describe('The account ID to query.'),
  });

export const dissociateTokenParameters = (_context: Context = {}) =>
  z.object({
    tokenIds: z
      .array(z.string())
      .min(1)
      .describe('The list of Hedera token IDs (strings) to dissociate. Must provide at least one.'),
    accountId: z
      .string()
      .optional()
      .describe(
        'The account ID from which to dissociate the tokens. Defaults to operator account.',
      ),
    transactionMemo: z.string().optional().describe('Optional memo for the transaction.'),
  });

export const dissociateTokenParametersNormalised = (_context: Context = {}) =>
  dissociateTokenParameters(_context).extend({
    tokenIds: z.array(z.instanceof(TokenId)),
    accountId: z.instanceof(AccountId),
  });

// Approve NFT Allowance
export const approveNftAllowanceParameters = (_context: Context = {}) =>
  z
    .object({
      ownerAccountId: z
        .string()
        .optional()
        .describe('Owner account ID (defaults to operator account ID if omitted)'),
      spenderAccountId: z.string().describe('Spender account ID'),
      tokenId: z.string().describe('The NFT token ID'),
      allSerials: z
        .boolean()
        .optional()
        .describe(
          'If true, approve allowance for all current and future serials of the NFT collection. If true, do not provide serialNumbers.',
        ),
      serialNumbers: z
        .array(z.number().int().nonnegative())
        .optional()
        .describe('Array of NFT serial numbers to approve. Required if allSerials is not true.'),
      transactionMemo: z.string().optional().describe('Memo to include with the transaction'),
    })
    .superRefine((val, ctx) => {
      const all = !!val.allSerials;
      const serials = val.serialNumbers ?? [];
      if (all && serials.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'When approving for all serials (allSerials=true), serialNumbers must not be provided.',
          path: ['serialNumbers'],
        });
      }
      if (!all && serials.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'serialNumbers must contain at least one serial when allSerials is not true.',
          path: ['serialNumbers'],
        });
      }
    });

export const approveNftAllowanceParametersNormalised = (_context: Context = {}) =>
  z.object({
    nftApprovals: z.array(z.instanceof(TokenNftAllowance)).optional(),
    transactionMemo: z.string().optional(),
  });

export const transferNonFungibleTokenWithAllowanceParameters = (_context: Context) =>
  z
    .object({
      sourceAccountId: z.string().describe('Account ID of the token owner (the allowance granter)'),
      tokenId: z.string().describe('The NFT token ID (e.g. "0.0.12345")'),
      recipients: z
        .array(
          z.object({
            recipientId: z.string().describe('Account ID of the recipient'),
            serialNumber: z.number().positive().describe('Serial number of the NFT to transfer'),
          }),
        )
        .min(1)
        .describe('Array of recipient and NFT serial number pairs to transfer'),
      transactionMemo: z
        .string()
        .optional()
        .describe('Optional memo to include with the transaction'),
    })
    .superRefine((val, ctx) => {
      // Optional custom validation logic
      const seenSerials = new Set<number>();
      for (const { serialNumber } of val.recipients) {
        if (seenSerials.has(serialNumber)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Duplicate serial number: ${serialNumber}`,
            path: ['recipients'],
          });
        }
        seenSerials.add(serialNumber);
      }
    });

export const transferNonFungibleTokenWithAllowanceParametersNormalised = (_context: Context) =>
  z.object({
    sourceAccountId: z.instanceof(AccountId),
    transactionMemo: z.string().optional(),
    transfers: z.array(
      z.object({
        nftId: z.instanceof(NftId),
        receiver: z.instanceof(AccountId),
      }),
    ),
  });

export const transferFungibleTokenWithAllowanceParameters = (context: Context = {}) =>
  optionalScheduledTransactionParams(context).extend({
    tokenId: z.string().describe('Token ID to transfer'),
    sourceAccountId: z.string().describe('Account ID of the token owner (the allowance granter)'),
    transfers: z
      .array(
        z.object({
          accountId: z.string().describe('Recipient account ID'),
          amount: z
            .number()
            .nonnegative()
            .describe('Amount of tokens to transfer in display unit.'),
        }),
      )
      .min(1)
      .describe('Array of recipient transfers'),
    transactionMemo: z.string().optional().describe('Memo for the transaction'),
  });

export const transferFungibleTokenWithAllowanceParametersNormalised = (context: Context = {}) =>
  optionalScheduledTransactionParamsNormalised(context).extend({
    tokenId: z.string(),
    tokenTransfers: z.custom<TokenTransferMinimalParams[]>(),
    approvedTransfer: z.object({
      ownerAccountId: z.string(),
      amount: z.number(),
    }),
    transactionMemo: z.string().optional(),
  });
