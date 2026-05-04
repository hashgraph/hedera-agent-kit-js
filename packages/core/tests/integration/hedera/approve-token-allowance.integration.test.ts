import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  Client,
  PublicKey,
  TokenId,
  TokenSupplyType,
} from '@hiero-ledger/sdk';
import approveTokenAllowanceTool from '@/plugins/core-token-plugin/tools/fungible-token/approve-token-allowance';
import { AgentMode, type Context } from '@/shared/configuration';
import {
  getProfile,
  HederaOperationsWrapper,
  type TestAccount,
} from '@hashgraph/hedera-agent-kit-tests';
import { z } from 'zod';
import { approveTokenAllowanceParameters } from '@/shared/parameter-schemas/token.zod';
import { waitForMirrorTx } from '@hashgraph/hedera-agent-kit-tests';

/**
 * Integration tests for Approve Token Allowance tool
 */

describe('Approve Token Allowance Integration Tests', () => {
  const profile = getProfile();
  let executor: TestAccount;
  let spender: TestAccount;
  let executorClient: Client;
  let executorWrapper: HederaOperationsWrapper;
  let context: Context;
  let tokenIdFT: TokenId;

  const FT_PARAMS = {
    tokenName: 'AllowToken',
    tokenSymbol: 'ALW',
    tokenMemo: 'FT',
    initialSupply: 1000,
    decimals: 2,
    maxSupply: 100000,
    supplyType: TokenSupplyType.Finite,
  };

  beforeAll(async () => {
    executor = await profile.accounts.acquire({ tier: 'ELEVATED' });
    ({ client: executorClient, wrapper: executorWrapper } = profile.client.connectAs(executor));

    spender = await profile.accounts.acquire({ tier: 'STANDARD' });

    context = {
      mode: AgentMode.AUTONOMOUS,
      accountId: executor.accountId.toString(),
    };

    const createTokenResp = await executorWrapper.createFungibleToken({
      ...FT_PARAMS,
      supplyKey: executor.privateKey.publicKey as PublicKey,
      adminKey: executor.privateKey.publicKey as PublicKey,
      treasuryAccountId: executor.accountId.toString(),
      autoRenewAccountId: executor.accountId.toString(),
    });
    tokenIdFT = createTokenResp.tokenId!;

    await waitForMirrorTx(executorWrapper, createTokenResp.transactionId!);
  });

  afterAll(async () => {
    await profile.accounts.release(spender);
    await profile.accounts.release(executor);
    executorClient?.close();
  });

  it('approves token allowance with explicit owner and memo', async () => {
    const params: z.infer<ReturnType<typeof approveTokenAllowanceParameters>> = {
      ownerAccountId: context.accountId!,
      spenderAccountId: spender.accountId.toString(),
      tokenApprovals: [{ tokenId: tokenIdFT.toString(), amount: 25 }],
      transactionMemo: 'Integration token approve',
    };

    const tool = approveTokenAllowanceTool(context);
    const result = await tool.execute(executorClient, context, params);

    expect(result.humanMessage).toContain('allowance(s) approved successfully');
    expect(result.humanMessage).toContain('Transaction ID:');
    expect(result.raw.status).toBe('SUCCESS');
    expect(result.raw.transactionId).toBeDefined();
  });

  it('approves multiple token allowances (single token repeated for test) with default owner', async () => {
    const params: z.infer<ReturnType<typeof approveTokenAllowanceParameters>> = {
      spenderAccountId: spender.accountId.toString(),
      tokenApprovals: [
        { tokenId: tokenIdFT.toString(), amount: 1 },
        { tokenId: tokenIdFT.toString(), amount: 2 },
      ],
    };

    const tool = approveTokenAllowanceTool(context);
    const result = await tool.execute(executorClient, context, params);

    expect(result.raw.status).toBe('SUCCESS');
    expect(result.raw.transactionId).toBeDefined();
  });
});
