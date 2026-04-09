import BigNumber from 'bignumber.js';

/**
 * Converts a token amount to base units (the smallest denomination).
 * Example: toBaseUnit(1.5, 8) => BigNumber(150000000)
 *
 * @param amount - The human-readable token amount (number or BigNumber).
 * @param decimals - The number of decimals the token uses.
 * @returns The amount in base units as BigNumber.
 */
export function toBaseUnit(amount: number | BigNumber, decimals: number): BigNumber {
  const amountBN = new BigNumber(amount);
  const multiplier = new BigNumber(10).pow(decimals);
  return amountBN.multipliedBy(multiplier).integerValue(BigNumber.ROUND_FLOOR);
}

/**
 * Converts a base unit amount to a human-readable value.
 * Example: toDisplayUnit(150000000, 8) => BigNumber(1.5)
 *
 * @param baseAmount - The amount in base units (number or BigNumber).
 * @param decimals - The number of decimals the token uses.
 * @returns The human-readable token amount as BigNumber.
 */
export function toDisplayUnit(baseAmount: number | BigNumber, decimals: number): BigNumber {
  const baseAmountBN = new BigNumber(baseAmount);
  const divisor = new BigNumber(10).pow(decimals);
  return baseAmountBN.dividedBy(divisor);
}
