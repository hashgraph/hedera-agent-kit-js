import HederaOperationsWrapper from '../hedera-operations/HederaOperationsWrapper';
import { toDisplayUnit } from '@hashgraph/hedera-agent-kit';
import { expect } from 'vitest';
import BigNumber from 'bignumber.js';

/**
 * Verifies an account's HBAR balance changed by exactly `expectedChange` (in HBAR).
 *
 * The verified account must NOT be the fee payer of the tx that produced the change.
 * This is true for: transfer recipients, allowance owners (spender pays the fee), and
 * any passive party that doesn't sign the SDK call. For an account that signs the tx
 * AND has its balance change measured, the post-balance is `before + change - fee`,
 * so snapshot a different account or assert the fee directly via the transaction record.
 */
export async function verifyHbarBalanceChange(
  accountId: string,
  balanceBeforeRaw: BigNumber,
  expectedChange: number,
  hederaOperationsWrapper: HederaOperationsWrapper,
): Promise<void> {
  const balanceBefore = toDisplayUnit(balanceBeforeRaw, 8);
  const balanceAfter = toDisplayUnit(
    await hederaOperationsWrapper.getAccountHbarBalance(accountId),
    8,
  );
  const expectedBalance = balanceBefore.plus(new BigNumber(expectedChange));

  expect(balanceAfter.decimalPlaces(8).isEqualTo(expectedBalance.decimalPlaces(8))).toBe(true);
}
