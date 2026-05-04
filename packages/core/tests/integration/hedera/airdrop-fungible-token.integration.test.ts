import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client, PublicKey, TokenId, TokenSupplyType } from '@hiero-ledger/sdk';
import airdropFungibleTokenTool from '@/plugins/core-token-plugin/tools/fungible-token/airdrop-fungible-token';
import { AgentMode, type Context } from '@/shared/configuration';
import {
  getProfile,
  HederaOperationsWrapper,
  type TestAccount,
} from '@hashgraph/hedera-agent-kit-tests';
import { z } from 'zod';
import { airdropFungibleTokenParameters } from '@/shared/parameter-schemas/token.zod';
import { wait } from '@hashgraph/hedera-agent-kit-tests';
import { MIRROR_NODE_WAITING_TIME } from '@hashgraph/hedera-agent-kit-tests';

describe('Airdrop Fungible Token Integration Tests', () => {
  const profile = getProfile();
  let executor: TestAccount;
  let executorClient: Client;
  let executorWrapper: HederaOperationsWrapper;
  let tokenIdFT: TokenId;
  let context: Context;

  const FT_PARAMS = {
    tokenName: 'AirdropToken',
    tokenSymbol: 'DROP',
    tokenMemo: 'FT-AIRDROP',
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

    await wait(MIRROR_NODE_WAITING_TIME);
  });

  afterAll(async () => {
    await profile.accounts.release(executor);
    executorClient?.close();
  });

  const createRecipientAccount = async (maxAutomaticTokenAssociations: number) => {
    const acquireOpts =
      maxAutomaticTokenAssociations === 0
        ? { preset: 'pending-airdrop-recipient' as const }
        : {};
    const recipient = await profile.accounts.acquire(acquireOpts);
    const { client: recipientClient, wrapper: recipientWrapper } =
      profile.client.connectAs(recipient);

    return { recipientId: recipient.accountId, recipientClient, recipientWrapper };
  };

  it('should airdrop tokens to a single recipient', async () => {
    const { recipientId, recipientClient } = await createRecipientAccount(0); // no automatic token associations

    const tool = airdropFungibleTokenTool(context);
    const params: z.infer<ReturnType<typeof airdropFungibleTokenParameters>> = {
      tokenId: tokenIdFT.toString(),
      sourceAccountId: executor.accountId.toString(),
      recipients: [
        {
          accountId: recipientId.toString(),
          amount: 50,
        },
      ],
    };

    const result: any = await tool.execute(executorClient, context, params);
    await wait(MIRROR_NODE_WAITING_TIME);

    expect(result).toBeDefined();
    expect(result.raw.status).toBe('SUCCESS');
    expect(result.humanMessage).toContain('Token successfully airdropped');

    const pending = await executorWrapper.getPendingAirdrops(recipientId.toString());
    expect(pending.airdrops.length).toBeGreaterThan(0);

    recipientClient.close();
  });

  it('should support multiple recipients in one airdrop', async () => {
    const recipient1 = await createRecipientAccount(0); // no automatic token associations
    const recipient2 = await createRecipientAccount(0); // no automatic token associations

    const tool = airdropFungibleTokenTool(context);
    const params: z.infer<ReturnType<typeof airdropFungibleTokenParameters>> = {
      tokenId: tokenIdFT.toString(),
      sourceAccountId: executor.accountId.toString(),
      recipients: [
        { accountId: recipient1.recipientId.toString(), amount: 10 },
        { accountId: recipient2.recipientId.toString(), amount: 20 },
      ],
    };

    const result: any = await tool.execute(executorClient, context, params);
    await wait(MIRROR_NODE_WAITING_TIME);

    expect(result.raw.status).toBe('SUCCESS');

    const pending1 = await executorWrapper.getPendingAirdrops(recipient1.recipientId.toString());
    const pending2 = await executorWrapper.getPendingAirdrops(recipient2.recipientId.toString());

    expect(pending1.airdrops.length).toBeGreaterThan(0);
    expect(pending2.airdrops.length).toBeGreaterThan(0);

    recipient1.recipientClient.close();
    recipient2.recipientClient.close();
  });

  it('should fail gracefully for non-existent token', async () => {
    const { recipientId, recipientClient } = await createRecipientAccount(0); // no automatic token associations

    const tool = airdropFungibleTokenTool(context);
    const params: z.infer<ReturnType<typeof airdropFungibleTokenParameters>> = {
      tokenId: '0.0.999999999',
      sourceAccountId: executor.accountId.toString(),
      recipients: [{ accountId: recipientId.toString(), amount: 5 }],
    };

    const result: any = await tool.execute(executorClient, context, params);

    expect(result.humanMessage).toContain('Failed to get token info for a token');

    recipientClient.close();
  });

  it('should fail when trying to airdrop more tokens than available', async () => {
    const { recipientId, recipientClient } = await createRecipientAccount(0);

    const tool = airdropFungibleTokenTool(context);
    const params: z.infer<ReturnType<typeof airdropFungibleTokenParameters>> = {
      tokenId: tokenIdFT.toString(),
      sourceAccountId: executor.accountId.toString(),
      recipients: [{ accountId: recipientId.toString(), amount: 999999999 }], // absurdly high
    };

    const result: any = await tool.execute(executorClient, context, params);

    expect(result.raw.error).toContain('INSUFFICIENT_TOKEN_BALANCE');

    recipientClient.close();
  });

  it('should reflect outstanding airdrops from executor account', async () => {
    const { recipientId, recipientClient } = await createRecipientAccount(0);

    const tool = airdropFungibleTokenTool(context);
    const params: z.infer<ReturnType<typeof airdropFungibleTokenParameters>> = {
      tokenId: tokenIdFT.toString(),
      sourceAccountId: executor.accountId.toString(),
      recipients: [{ accountId: recipientId.toString(), amount: 25 }],
    };

    const result: any = await tool.execute(executorClient, context, params);
    await wait(MIRROR_NODE_WAITING_TIME);

    expect(result.raw.status).toBe('SUCCESS');

    const outstanding = await executorWrapper.getOutstandingAirdrops(executor.accountId.toString());
    expect(outstanding.airdrops.some(a => a.token_id === tokenIdFT.toString())).toBe(true);

    recipientClient.close();
  });
});
