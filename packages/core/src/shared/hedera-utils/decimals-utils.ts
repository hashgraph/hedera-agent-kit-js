import BigNumber from 'bignumber.js';
import { IHederaMirrornodeService } from '@/shared';

// Function selector of ERC20 `decimals()`
const ERC20_DECIMALS_SELECTOR = '0x313ce567';

// HTTP statuses that indicate a transient failure worth retrying (e.g. solo mirror-node web3 warmup)
const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);

/**
 * Reads the `decimals()` value of an ERC20 contract via the mirror node
 * read-only `/contracts/call` endpoint.
 *
 * Retries on transient 5xx/429 responses (up to 5 attempts, exponential backoff starting at 1s)
 * to handle cases where the mirror node's web3 simulation module is temporarily unavailable
 * (e.g. during solo network warmup).  Non-transient errors (e.g. 400) throw immediately.
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
  const url = `${mirrorNode.getBaseUrl()}/contracts/call`;
  const body = JSON.stringify({ data: ERC20_DECIMALS_SELECTOR, to: contractInfo.evm_address });
  const maxAttempts = 5;
  let delayMs = 1000;

  for (let attempt = 1; ; attempt++) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    if (response.ok) {
      const { result } = (await response.json()) as { result: string };
      return Number(BigInt(result));
    }
    if (RETRYABLE_STATUSES.has(response.status) && attempt < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
      delayMs *= 2;
      continue;
    }
    throw new Error(
      `Failed to read decimals of ERC20 contract ${contractId}: ${response.status} ${response.statusText}`,
    );
  }
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
