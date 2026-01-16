import { Policy, ToolExecutionPoint } from '@/shared';
import { Hbar } from '@hashgraph/sdk';

export class MaxHbarTransferPolicy implements Policy {
  name = 'Max HBAR Transfer';
  description = 'Limits the maximum HBAR amount that can be transferred';
  relevantTools = ['transfer_hbar_tool', 'transfer_hbar_with_allowance_tool']; //FIXME: those tools do not support policies yet
  affectedPoints = [ToolExecutionPoint.PostParamsNormalization];

  constructor(private maxAmount: number) { }

  shouldBlock(params: any): boolean {
    // 1. Check transfer_hbar and transfer_hbar_with_allowance
    // Both use hbarTransfers array in normalised params (for transfer_hbar it includes source debit)
    if (params.hbarTransfers) {
      for (const t of params.hbarTransfers) {
        // We only care about positive transfers (credits to others) to limit value being sent.
        // For transfer_hbar, the source debit is negative.
        // For transfer_hbar_with_allowance, transfers are destinations (positive).
        if (t.amount instanceof Hbar) {
          const hbarAmount = t.amount.toBigNumber().toNumber();
          if (hbarAmount > 0 && hbarAmount > this.maxAmount) return true;
        }
      }
    }

    return false;
  }
}
