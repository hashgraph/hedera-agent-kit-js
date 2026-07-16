import BigNumber from 'bignumber.js';
import { IHederaMirrornodeService } from './mirrornode/hedera-mirrornode-service.interface';

// Function selector of ERC20 `decimals()`
const ERC20_DECIMALS_SELECTOR = '0x313ce567';

/**
 * Reads the `decimals()` value of an ERC20 contract via the mirror node
 * read-only `/contracts/call` endpoint
 *
 * @param contractId - The Hedera contract ID (shard.realm.num).
 * @param mirrorNode - Mirror node service used to resolve the contract and perform the call.
 * @returns The number of decimals the token uses.
 */
export async function getERC20Decimals(
  contractId: string,
  mirrorNode: IHederaMirrornodeService,
): Promise<number> {
  const contractInfo = await mirrorNode.getContractInfo(contractId);
  const response = await fetch(`${mirrorNode.getBaseUrl()}/contracts/call`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: ERC20_DECIMALS_SELECTOR, to: contractInfo.evm_address }),
  });
  if (!response.ok) {
    throw new Error(
      `Failed to read decimals of ERC20 contract ${contractId}: ${response.status} ${response.statusText}`,
    );
  }
  const { result } = (await response.json()) as { result: string };
  return Number(BigInt(result));
}

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
