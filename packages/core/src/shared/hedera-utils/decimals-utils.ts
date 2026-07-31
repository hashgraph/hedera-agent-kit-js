import BigNumber from 'bignumber.js';
import Long from 'long';

/**
 * HTS token amounts are stored as int64 on-chain.
 * Long.MAX_VALUE = 2^63 − 1 = 9,223,372,036,854,775,807.
 */
export const HTS_INT64_MAX = new BigNumber('9223372036854775807');

/**
 * Converts a token amount to base units (the smallest denomination).
 * Example: toBaseUnit(1.5, 8) => BigNumber(150000000)
 *
 * @param amount - The human-readable token amount (number, numeric string, or BigNumber).
 *   Note: if `amount` is a JS `number` that has already lost precision above 2^53, passing
 *   it as a string will not recover that precision — convert to string before the precision
 *   is lost (i.e. before the number is parsed from JSON or received as a function argument).
 * @param decimals - The number of decimals the token uses.
 * @returns The amount in base units as BigNumber.
 */
export function toBaseUnit(amount: number | string | BigNumber, decimals: number): BigNumber {
  const amountBN = new BigNumber(amount);
  const multiplier = new BigNumber(10).pow(decimals);
  return amountBN.multipliedBy(multiplier).integerValue(BigNumber.ROUND_FLOOR);
}

/**
 * Converts a display-unit amount to a precision-safe int64 Long for HTS transactions.
 *
 * Uses BigNumber arithmetic throughout to avoid float64 precision loss, then validates
 * that the result fits within the HTS int64 range before returning a Long.
 *
 * @param amount - The human-readable token amount (number, numeric string, or BigNumber).
 * @param decimals - The number of decimals the token uses.
 * @param label - Descriptive name included in the error message if the value overflows (default "amount").
 * @returns The amount in base units as a Long.
 * @throws {Error} if the base-unit value exceeds Long.MAX_VALUE (9,223,372,036,854,775,807).
 */
export function toBaseUnitLong(
  amount: number | string | BigNumber,
  decimals: number,
  label = 'amount',
): Long {
  const bn = toBaseUnit(amount, decimals);
  if (bn.gt(HTS_INT64_MAX)) {
    throw new Error(
      `${label} in base units (${bn.toFixed()}) exceeds the HTS int64 maximum ` +
        `of ${HTS_INT64_MAX.toFixed()}. HTS token amounts are stored as int64; ` +
        `use a smaller display-unit value.`,
    );
  }
  return Long.fromString(bn.toFixed(0));
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
