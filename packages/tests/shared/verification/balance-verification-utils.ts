import HederaOperationsWrapper from '../hedera-operations/HederaOperationsWrapper';
import { toDisplayUnit } from '@hashgraph/hedera-agent-kit';
import { expect } from 'vitest';
import BigNumber from 'bignumber.js';

/**
 * Verifies an account's HBAR balance changed by exactly `expectedChange` (in HBAR).
 *
 * Use this on the *recipient* side of a transfer. The recipient doesn't pay the
 * transaction fee, so the post-transfer balance equals `balanceBefore + expectedChange`
 * exactly. For sender-side checks the assertion would need a fee tolerance — don't
 * call this on the payer.
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
