import { Context } from '@/shared/configuration';
import { z } from 'zod';

export const contractExecuteTransactionParametersNormalised = (_context: Context = {}) =>
  z.object({
    contractId: z.string().describe('The ID of the contract to execute.'),
    functionParameters: z
      .instanceof(Uint8Array)
      .describe('The parameters of the function to execute.'),
    gas: z.number().int().describe('The gas limit for the contract call.'),
  });

export const transferERC20Parameters = (_context: Context = {}) =>
  z.object({
    contractId: z.string().describe('The id of the ERC20 contract.'),
    recipientAddress: z.string().describe('Address to which the tokens will be transferred.'),
    amount: z.number().describe('The amount of tokens to transfer.'),
  });

export const createERC721Parameters = (_context: Context = {}) =>
  z.object({
    tokenName: z.string().describe('The name of the token.'),
    tokenSymbol: z.string().describe('The symbol of the token.'),
    baseURI: z.string().default('').describe('The base URI for token metadata.'),
  });

export const createERC20Parameters = (_context: Context = {}) =>
  z.object({
    tokenName: z.string().describe('The name of the token.'),
    tokenSymbol: z.string().describe('The symbol of the token.'),
    decimals: z
      .number()
      .int()
      .min(0)
      .default(18)
      .describe('The number of decimals the token supports.'),
    initialSupply: z.number().int().min(0).default(0).describe('The initial supply of the token.'),
  });

export const transferERC721Parameters = (_context: Context = {}) =>
  z.object({
    contractId: z.string().describe('The id of the ERC721 contract.'),
    fromAddress: z.string().describe('Address from which the token will be transferred.'),
    toAddress: z.string().describe('Address to which the token will be transferred.'),
    tokenId: z.number().describe('The ID of the token to transfer.'),
  });

export const mintERC721Parameters = (_context: Context = {}) =>
  z.object({
    contractId: z.string().describe('The id of the ERC721 contract.'),
    toAddress: z.string().describe('Address to which the token will be minted.'),
  });
