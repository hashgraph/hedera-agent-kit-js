import { Policy } from '@/shared';
import { TokenId, NftId } from '@hashgraph/sdk';

export class TokenAllowlistPolicy implements Policy {
  name = 'Token Allowlist';
  description = 'Only allows interactions with specific Token IDs';
  relevantTools = [
    'transfer_non_fungible_token_tool',
    'transfer_non_fungible_token_with_allowance_tool',
    'transfer_fungible_token_with_allowance_tool',
    'mint_fungible_token_tool',
    'mint_non_fungible_token_tool',
    'burn_token_tool',
    'wipe_token_tool',
    'associate_token_tool',
    'dissociate_token_tool',
    'approve_nft_allowance_tool',
    'delete_nft_allowance_tool',
    'approve_token_allowance_tool',
    'delete_token_allowance_tool',
    'update_token_tool',
    'pause_token_tool',
    'unpause_token_tool',
    'freeze_token_tool',
    'unfreeze_token_tool',
    'grant_token_kyc_tool',
    'revoke_token_kyc_tool',
    'airdrop_fungible_token_tool',
  ];

  /* Set of allowed token IDs (string format) */
  private allowedTokens: Set<string>;

  constructor(allowedTokens: string[]) {
    this.allowedTokens = new Set(allowedTokens);
  }

  shouldBlock(params: any): boolean {
    const tokensToCheck: string[] = [];

    // Helper to add if valid
    const add = (t: any) => {
      if (t instanceof TokenId || (typeof t === 'object' && t.toString)) {
        tokensToCheck.push(t.toString());
      } else if (typeof t === 'string') {
        tokensToCheck.push(t);
      }
    };

    // 1. Direct tokenId field
    if (params.tokenId) {
      add(params.tokenId);
    }

    // 2. Array of tokenIds
    if (params.tokenIds && Array.isArray(params.tokenIds)) {
      params.tokenIds.forEach(add);
    }

    // 3. tokenTransfers (e.g. fs transfer)
    if (params.tokenTransfers && Array.isArray(params.tokenTransfers)) {
      params.tokenTransfers.forEach((t: any) => {
        if (t.tokenId) add(t.tokenId);
      });
    }

    // 4. transfers with nftId (NFT transfer)
    if (params.transfers && Array.isArray(params.transfers)) {
      params.transfers.forEach((t: any) => {
        if (t.nftId && t.nftId instanceof NftId) {
          add(t.nftId.tokenId);
        }
      });
    }

    // 5. nftApprovals
    if (params.nftApprovals && Array.isArray(params.nftApprovals)) {
      params.nftApprovals.forEach((a: any) => {
        if (a.tokenId) add(a.tokenId);
      });
    }

    // 6. tokenApprovals
    if (params.tokenApprovals && Array.isArray(params.tokenApprovals)) {
      params.tokenApprovals.forEach((a: any) => {
        if (a.tokenId) add(a.tokenId);
      });
    }

    // 7. nftWipes
    if (params.nftWipes && Array.isArray(params.nftWipes)) {
      params.nftWipes.forEach((n: any) => {
        if (n instanceof NftId) add(n.tokenId);
      });
    }

    // Check all gathered tokens
    for (const token of tokensToCheck) {
      if (!this.allowedTokens.has(token)) {
        return true; // Block if any token is not in allowlist
      }
    }

    return false;
  }
}
