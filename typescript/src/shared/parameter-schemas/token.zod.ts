import { Context } from '@/shared/configuration';
import { z } from 'zod';
import { AccountId, PublicKey, TokenId, TokenSupplyType, TokenType } from '@hashgraph/sdk';
import { TokenTransferMinimalParams } from '@/shared/hedera-utils/types';

export const createFungibleTokenParameters = (_context: Context = {}) =>
  z.object({
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
  createFungibleTokenParameters(_context).extend({
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
  });

export const createNonFungibleTokenParameters = (_context: Context = {}) =>
  z.object({
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
  createNonFungibleTokenParameters(_context).extend({
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
  z.object({
    tokenId: z.string().describe('The id of the token.'),
    amount: z.number().describe('The amount of tokens to mint.'),
  });

export const mintFungibleTokenParametersNormalised = (_context: Context = {}) =>
  mintFungibleTokenParameters(_context).extend({});

export const mintNonFungibleTokenParameters = (_context: Context = {}) =>
  z.object({
    tokenId: z.string().describe('The id of the NFT class.'),
    uris: z.array(z.string().max(100)).max(10).describe('An array of URIs hosting NFT metadata.'),
  });

export const mintNonFungibleTokenParametersNormalised = (_context: Context = {}) =>
  mintNonFungibleTokenParameters(_context).extend({});

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
