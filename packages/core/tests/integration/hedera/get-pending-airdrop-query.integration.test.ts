import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client, AccountId, PublicKey, TokenId, TokenSupplyType } from '@hiero-ledger/sdk';
import getPendingAirdropTool from '@/plugins/core-token-query-plugin/tools/queries/get-pending-airdrop-query';
import { AgentMode, type Context } from '@/shared/configuration';
import {
  getProfile,
  HederaOperationsWrapper,
  type TestAccount,
} from '@hashgraph/hedera-agent-kit-tests';
import { z } from 'zod';
import { accountBalanceQueryParameters } from '@/shared/parameter-schemas/account.zod';
import { waitFor } from '@hashgraph/hedera-agent-kit-tests';

describe('Get Pending Airdrop Query Integration Tests', () => {
  const profile = getProfile();
  let executor: TestAccount;
  let recipient: TestAccount;
  let executorClient: Client;
  let executorWrapper: HederaOperationsWrapper;
  let context: Context;
  let tokenIdFT: TokenId;
  let recipientId: AccountId;

  const FT_PARAMS = {
    tokenName: 'AirdropQueryToken',
    tokenSymbol: 'ADQ',
    tokenMemo: 'FT-PENDING-QUERY',
    initialSupply: 100000,
    decimals: 2,
    maxSupply: 500000,
    supplyType: TokenSupplyType.Finite,
  };

  beforeAll(async () => {
    executor = await profile.accounts.acquire({ tier: 'STANDARD' });
    ({ client: executorClient, wrapper: executorWrapper } = profile.client.connectAs(executor));

    context = {
      mode: AgentMode.AUTONOMOUS,
      accountId: executor.accountId.toString(),
    };

    tokenIdFT = await executorWrapper
      .createFungibleToken({
        ...FT_PARAMS,
        supplyKey: executor.privateKey.publicKey as PublicKey,
        adminKey: executor.privateKey.publicKey as PublicKey,
        treasuryAccountId: executor.accountId.toString(),
        autoRenewAccountId: executor.accountId.toString(),
      })
      .then(resp => resp.tokenId!);

    // Create recipient with 0 auto-associations to ensure airdrop is pending
    recipient = await profile.accounts.acquire({ preset: 'pending-airdrop-recipient' });
    recipientId = recipient.accountId;

    // Airdrop tokens to recipient so they appear as pending
    await executorWrapper.airdropToken({
      tokenTransfers: [
        { tokenId: tokenIdFT.toString(), accountId: recipientId.toString(), amount: 100 },
        { tokenId: tokenIdFT.toString(), accountId: executor.accountId.toString(), amount: -100 },
      ],
    });

    // Poll mirror until the airdrop has been ingested as pending — adaptive wait
    // (returns as soon as data is visible; bounded by timeoutMs).
    await waitFor(
      async () => {
        const pending = await executorWrapper.getPendingAirdrops(recipientId.toString());
        return pending.airdrops.length > 0 ? pending : null;
      },
      { timeoutMs: 10000, intervalMs: 250, description: 'pending airdrop to appear in mirror' },
    );
  });

  afterAll(async () => {
    await profile.accounts.release(recipient);
    await profile.accounts.release(executor);
    executorClient?.close();
  });

  it('should return pending airdrops for a recipient account', async () => {
    const tool = getPendingAirdropTool(context);
    const params: z.infer<ReturnType<typeof accountBalanceQueryParameters>> = {
      accountId: recipientId.toString(),
    };

    const result: any = await tool.execute(executorClient, context, params);

    expect(result.humanMessage).toContain(
      `pending airdrops for account **${recipientId.toString()}**`,
    );
    expect(Array.isArray(result.raw.pendingAirdrops.airdrops)).toBe(true);
    expect(result.raw.pendingAirdrops.airdrops.length).toBeGreaterThan(0);
  });

  it('should fail gracefully for invalid account', async () => {
    const tool = getPendingAirdropTool(context);
    const params: z.infer<ReturnType<typeof accountBalanceQueryParameters>> = {
      accountId: '0.0.999999999',
    };

    const result: any = await tool.execute(executorClient, context, params);
    expect(result.humanMessage).toContain('No pending airdrops found for account');
  });
});
