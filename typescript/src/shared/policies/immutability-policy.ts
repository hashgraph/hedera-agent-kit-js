import { Policy } from '@/shared';
import { AccountId, TokenId } from '@hashgraph/sdk';

export class ImmutabilityPolicy implements Policy {
  name = 'Immutability Policy';
  description = 'Prevents modification or deletion of specific Accounts and Tokens';
  relevantTools = ['update_account_tool', 'delete_account_tool', 'update_token_tool'];

  private immutableAccounts: Set<string> = new Set();
  private immutableTokens: Set<string> = new Set();

  constructor(config: { accounts?: string[]; tokens?: string[] }) {
    if (config.accounts) config.accounts.forEach(id => this.immutableAccounts.add(id));
    if (config.tokens) config.tokens.forEach(id => this.immutableTokens.add(id));
  }

  shouldBlock(params: any): boolean {
    // Check Account ID
    if (params.accountId) {
      const id =
        params.accountId instanceof AccountId ? params.accountId.toString() : params.accountId;
      if (typeof id === 'string' && this.immutableAccounts.has(id)) {
        return true;
      }
    }

    // Check Token ID
    if (params.tokenId) {
      const id = params.tokenId instanceof TokenId ? params.tokenId.toString() : params.tokenId;
      if (typeof id === 'string' && this.immutableTokens.has(id)) {
        return true;
      }
    }

    return false;
  }
}
