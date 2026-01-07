/**
 * Converts a tinybar amount to a hbar amount.
 * @param tinyBars - The tinybar amount.
 * @returns The hbar amount.
 */
export function toHbar(tinyBars: BigNumber): BigNumber {
  return tinyBars.div(100000000);
}
