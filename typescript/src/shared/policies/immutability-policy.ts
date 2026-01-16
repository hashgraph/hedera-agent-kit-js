import { Policy } from '@/shared';
import { AccountId, TokenId } from '@hashgraph/sdk';
import { z } from 'zod';

// Zod schemas for runtime shape detection
// Using .passthrough() to allow extra fields without failing validation
const HasAccountId = z
  .object({
    accountId: z.union([z.string(), z.instanceof(AccountId)]),
  })
  .passthrough();

const HasTokenId = z
  .object({
    tokenId: z.instanceof(TokenId),
  })
  .passthrough();

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

  shouldBlock(params: unknown): boolean {
    // Check for accountId using Zod runtime validation
    const accountResult = HasAccountId.safeParse(params);
    if (accountResult.success) {
      const accountId = accountResult.data.accountId.toString();
      if (accountId && this.immutableAccounts.has(accountId)) {
        return true;
      }
    }

    // Check for tokenId using Zod runtime validation
    const tokenResult = HasTokenId.safeParse(params);
    if (tokenResult.success) {
      const tokenId = tokenResult.data.tokenId.toString();
      if (tokenId && this.immutableTokens.has(tokenId)) {
        return true;
      }
    }

    return false;
  }
}
