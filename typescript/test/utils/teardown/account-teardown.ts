import { AccountId, Hbar, HbarUnit } from '@hashgraph/sdk';
import { HederaOperationsWrapper } from '../index';
import { toBaseUnit } from '@/shared/hedera-utils/decimals-utils';

/**
 * Attempts to delete a test account and return its HBAR balance to a specified account.
 *
 * This utility function is designed for test cleanup to conserve HBAR resources. It first
 * attempts to delete the account (which transfers all HBARs to the return account). If
 * deletion fails due to the account holding tokens, it falls back to transferring the
 * available HBAR balance manually, leaving a small amount to cover transaction fees.
 *
 * @param accountToDeleteWrapper - The HederaOperationsWrapper instance for the account to be deleted
 * @param accountToDelete - The AccountId of the account to delete and drain HBARs from
 * @param accountToReturn - The AccountId where the HBARs should be returned (typically the operator account)
 *
 * @returns Promise<void> - Resolves when the operation completes successfully
 *
 * @throws {Error} Logs errors to console but does not throw. If account deletion fails,
 *                 it attempts HBAR recovery. If HBAR transfer also fails, the error is logged.
 *
 * @example
 * ```typescript
 * import { AccountId } from '@hashgraph/sdk';
 * import { HederaOperationsWrapper } from '../index';
 * import { returnHbarsAndDeleteAccount } from './account-teardown';
 *
 * // Clean up a test account after test completion
 * const testAccountWrapper = new HederaOperationsWrapper(testClient);
 * const testAccountId = AccountId.fromString('0.0.12345');
 * const operatorAccountId = AccountId.fromString('0.0.2');
 *
 * await returnHbarsAndDeleteAccount(
 *   testAccountWrapper,
 *   testAccountId,
 *   operatorAccountId
 * );
 * ```
 *
 * @remarks
 * - Tests consume significant HBAR resources, so this function helps recover those costs
 * - Account deletion is only possible if the account holds no tokens
 * - When deletion fails, the function leaves 0.1 HBAR in the account to pay for the transfer transaction
 * - This is a best-effort operation that prioritizes HBAR recovery over strict error handling
 * - The function uses a try-catch pattern where failure to delete triggers a fallback HBAR transfer
 */
export const returnHbarsAndDeleteAccount = async (
  accountToDeleteWrapper: HederaOperationsWrapper,
  accountToDelete: AccountId,
  accountToReturn: AccountId,
) => {
  try {
    // if accountToDelete has tokens, this will fail
    await accountToDeleteWrapper.deleteAccount({
      accountId: accountToDelete,
      transferAccountId: accountToReturn,
    });
  } catch (_e) {
    console.error(
      'Error deleting account. The HBARs will be transferred to the operator account but this account wont be deleted.',
    );
    // if we can't delete the account, at least return the hbars to the operator account
    const accountToDeleteBalance = await accountToDeleteWrapper.getAccountHbarBalance(
      accountToDelete.toString(),
    );
    const transferAmount = accountToDeleteBalance.toNumber() - toBaseUnit(0.1, 8).toNumber(); // leave a small amount to pay for the tx
    const transferAmountHbar = new Hbar(transferAmount, HbarUnit.Tinybar);

    if (transferAmount < 0) throw new Error('Not enough HBAR to return');

    await accountToDeleteWrapper.transferHbar({
      hbarTransfers: [
        { accountId: accountToReturn, amount: transferAmountHbar },
        { accountId: accountToDelete, amount: transferAmountHbar.negated() },
      ],
    });
  }
};
