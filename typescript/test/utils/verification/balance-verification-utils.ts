import HederaOperationsWrapper from '../hedera-operations/HederaOperationsWrapper';
import { toDisplayUnit } from '@/shared/hedera-utils/decimals-utils';
import { expect } from 'vitest';
import BigNumber from 'bignumber.js';

/**
 * Helper function to verify HBAR balance changes after transactions
 * Note: HBAR has 8 decimal places
 */
export async function verifyHbarBalanceChange(
  accountId: string,
  balanceBeforeRaw: BigNumber,
  expectedChange: number,
  hederaOperationsWrapper: HederaOperationsWrapper,
): Promise<void> {
  const balanceBefore = toDisplayUnit(balanceBeforeRaw, 8); // HBAR has 8 decimal places
  const balanceAfter = toDisplayUnit(
    await hederaOperationsWrapper.getAccountHbarBalance(accountId),
    8,
  );

  const expectedBalance = balanceBefore.plus(new BigNumber(expectedChange));

  console.log(
    `Verifying balance change for account ${accountId}. It was ${balanceBefore.toFixed(8)} HBAR before, should be ${expectedBalance.toFixed(8)} HBAR after. Fetched balance is ${balanceAfter.toFixed(8)} HBAR.`,
  );

  // Use BigNumber comparison with proper decimal precision (8 places for HBAR)
  expect(balanceAfter.decimalPlaces(8).isEqualTo(expectedBalance.decimalPlaces(8))).toBe(true);
}

/**
 * Helper function to verify HTS token balance changes after transactions
 */
export async function verifyTokenBalanceChange(
  accountId: string,
  tokenId: string,
  balanceBeforeRaw: BigNumber,
  expectedChange: number,
  decimals: number,
  hederaOperationsWrapper: HederaOperationsWrapper,
): Promise<void> {
  const balanceBefore = toDisplayUnit(balanceBeforeRaw, decimals);
  const tokenBalance = await hederaOperationsWrapper.getAccountTokenBalance(accountId, tokenId);
  const balanceAfter = toDisplayUnit(new BigNumber(tokenBalance.balance), decimals);

  const expectedBalance = balanceBefore.plus(new BigNumber(expectedChange));

  console.log(
    `Verifying token balance change for account ${accountId} and token ${tokenId}. It was ${balanceBefore.toFixed(decimals)} before, should be ${expectedBalance.toFixed(decimals)} after. Fetched balance is ${balanceAfter.toFixed(decimals)}.`,
  );

  // Use BigNumber comparison with proper decimal precision
  expect(
    balanceAfter.decimalPlaces(decimals).isEqualTo(expectedBalance.decimalPlaces(decimals)),
  ).toBe(true);
}
