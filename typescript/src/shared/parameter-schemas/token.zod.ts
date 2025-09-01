import { Context } from '@/shared/configuration';
import { z } from 'zod';
import { PublicKey, TokenSupplyType, TokenType } from '@hashgraph/sdk';
import { TokenTransferMinimalParams } from '@/shared/hedera-utils/types';

export const createFungibleTokenParameters = (_context: Context = {}) =>
  z.object({
    tokenName: z.string().describe('The name of the token.'),
    tokenSymbol: z.string().describe('The symbol of the token.'),
    initialSupply: z.number().int().default(0).describe('The initial supply of the token.'),
    supplyType: z.enum(['finite', 'infinite']).optional().describe('Supply type of the token.'),
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
    autoRenewAccountId: z
      .string()
      .describe(
        'The auto renew account for the token. If not provided, defaults to the operator account.',
      ),
    supplyKey: z
      .custom<PublicKey>()
      .optional()
      .describe('The supply key. If not provided, defaults to the operator’s public key.'),
    supplyType: z.custom<TokenSupplyType>().describe('Supply type of the token.'),
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
