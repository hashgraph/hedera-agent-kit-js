import { TokenId } from "@hashgraph/sdk";
import BigNumber from 'bignumber.js';
import { AccountResolver } from "hedera-agent-kit";


/**
 * Handles response formatting for both autonomous and manual modes
 */
export const handleResponse = (data: any, message: string) => {
  return {
    success: true,
    data,
    message,
  };
};

/**
 * Converts decimal amount to tiny units (wei)
 */
export const toTiny = (amount: number | string): string => {
  const amountBigInt = typeof amount === "string" ? BigInt(amount) : BigInt(amount);
  return amountBigInt.toString();
};

/**
 * Validates token addresses
 */
export const isValidAddress = (address: string): boolean => {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
};

/**
 * Normalizes token addresses to lowercase
 */
export const normalizeAddress = (address: string): string => {
  if (!isValidAddress(address)) {
    throw new Error(`Invalid address: ${address}`);
  }
  return address.toLowerCase();
};

/**
 * Sorts token addresses for consistent pair ordering
 */
export const sortTokens = (tokenA: string, tokenB: string): [string, string] => {
  const normalizedA = normalizeAddress(tokenA);
  const normalizedB = normalizeAddress(tokenB);
  
  if (normalizedA === normalizedB) {
    throw new Error("Cannot create pool with same token");
  }
  
  return normalizedA < normalizedB ? [normalizedA, normalizedB] : [normalizedB, normalizedA];
};

/**
 * Calculates slippage bounds
 */
export const calculateSlippageBounds = (
  amount: bigint,
  slippageBps: number
): { min: bigint; max: bigint } => {
  const slippageMultiplier = BigInt(10000 - slippageBps);
  const min = (amount * slippageMultiplier) / 10000n;
  
  const maxMultiplier = BigInt(10000 + slippageBps);
  const max = (amount * maxMultiplier) / 10000n;
  
  return { min, max };
};

/**
 * Formats amount with decimals
 */
export const formatAmount = (amount: bigint, decimals: number): string => {
  const divisor = BigInt(10 ** decimals);
  const whole = amount / divisor;
  const fractional = amount % divisor;
  
  if (fractional === 0n) {
    return whole.toString();
  }
  
  const fractionalStr = fractional.toString().padStart(decimals, '0');
  const trimmed = fractionalStr.replace(/0+$/, '');
  
  if (trimmed === '') {
    return whole.toString();
  }
  
  return `${whole}.${trimmed}`;
};

export const getHederaTokenEVMAddress = (address: string) => {
  if (!AccountResolver.isHederaAddress(address)) {
    return address;
  }
  const token = TokenId.fromString(address);
  return '0x' + token.toEvmAddress();
}

export function toBaseUnit(amount: number | BigNumber, decimals: number): BigNumber {
  const amountBN = new BigNumber(amount);
  const multiplier = new BigNumber(10).pow(decimals);
  return amountBN.multipliedBy(multiplier).integerValue(BigNumber.ROUND_FLOOR);
}