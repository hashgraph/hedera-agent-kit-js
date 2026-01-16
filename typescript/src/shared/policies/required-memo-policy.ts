import { Policy } from '@/shared';

export class RequiredMemoPolicy implements Policy {
  name = 'Required Memo';
  description = 'Ensures that every transaction includes a non-empty memo';
  relevantTools = [
    'transfer_hbar_tool',
    'transfer_hbar_with_allowance_tool',
    'create_account_tool',
    'create_fungible_token_tool',
    'create_non_fungible_token_tool',
    'create_topic_tool',
    'transfer_non_fungible_token_tool',
    'transfer_fungible_token_with_allowance_tool',
    'approve_hbar_allowance_tool',
    'approve_nft_allowance_tool',
    'approve_token_allowance_tool',
  ];

  shouldBlock(params: any): boolean {
    // Check if transactionMemo is present and non-empty
    return !params.transactionMemo || params.transactionMemo.trim().length === 0;
  }
}
