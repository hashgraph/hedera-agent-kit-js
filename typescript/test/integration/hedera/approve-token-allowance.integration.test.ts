import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  AccountId,
  Client,
  Key,
  PrivateKey,
  PublicKey,
  TokenId,
  TokenSupplyType,
} from '@hashgraph/sdk';
import approveTokenAllowanceTool from '@/plugins/core-token-plugin/tools/fungible-token/approve-token-allowance';
import { Context, AgentMode } from '@/shared/configuration';
import { getCustomClient, getOperatorClientForTests, HederaOperationsWrapper } from '../../utils';
import { z } from 'zod';
import { approveTokenAllowanceParameters } from '@/shared/parameter-schemas/account.zod';
import { wait } from '../../utils/general-util';
import { MIRROR_NODE_WAITING_TIME } from '../../utils/test-constants';
import { returnHbarsAndDeleteAccount } from '../../utils/teardown/account-teardown';

/**
 * Integration tests for Approve Token Allowance tool
 */

describe('Approve Token Allowance Integration Tests', () => {
  let operatorClient: Client;
  let executorClient: Client;
  let context: Context;
  let spenderAccountId: AccountId;
  let executorWrapper: HederaOperationsWrapper;
  let operatorWrapper: HederaOperationsWrapper;
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
    operatorClient = getOperatorClientForTests();
    operatorWrapper = new HederaOperationsWrapper(operatorClient);

    const executorKey = PrivateKey.generateED25519();
    const executorAccountId = await operatorWrapper
      .createAccount({ key: executorKey.publicKey, initialBalance: 15 })
      .then(resp => resp.accountId!);

    executorClient = getCustomClient(executorAccountId, executorKey);
    executorWrapper = new HederaOperationsWrapper(executorClient);

    spenderAccountId = await executorWrapper
      .createAccount({ key: executorClient.operatorPublicKey as Key, initialBalance: 5 })
      .then(resp => resp.accountId!);

    context = {
      mode: AgentMode.AUTONOMOUS,
      accountId: executorAccountId.toString(),
    };

    tokenIdFT = await executorWrapper
      .createFungibleToken({
        ...FT_PARAMS,
        supplyKey: executorClient.operatorPublicKey! as PublicKey,
        adminKey: executorClient.operatorPublicKey! as PublicKey,
        treasuryAccountId: executorAccountId.toString(),
        autoRenewAccountId: executorAccountId.toString(),
      })
      .then(resp => resp.tokenId!);

    await wait(MIRROR_NODE_WAITING_TIME);
  });

  afterAll(async () => {
    if (executorClient) {
      try {
        await returnHbarsAndDeleteAccount(
          executorWrapper,
          spenderAccountId,
          operatorClient.operatorAccountId!,
        );
        await returnHbarsAndDeleteAccount(
          executorWrapper,
          executorClient.operatorAccountId!,
          operatorClient.operatorAccountId!,
        );
      } catch (e) {
        console.warn('Failed to clean up accounts:', e);
      }
      executorClient.close();
    }
    if (operatorClient) operatorClient.close();
  });

  it('approves token allowance with explicit owner and memo', async () => {
    const params: z.infer<ReturnType<typeof approveTokenAllowanceParameters>> = {
      ownerAccountId: context.accountId!,
      spenderAccountId: spenderAccountId.toString(),
      tokenApprovals: [{ tokenId: tokenIdFT.toString(), amount: 25 }],
      transactionMemo: 'Integration token approve',
    };

    await wait(MIRROR_NODE_WAITING_TIME);

    const tool = approveTokenAllowanceTool(context);
    const result = await tool.execute(executorClient, context, params);

    expect(result.humanMessage).toContain('allowance(s) approved successfully');
    expect(result.humanMessage).toContain('Transaction ID:');
    expect(result.raw.status).toBe('SUCCESS');
    expect(result.raw.transactionId).toBeDefined();
  });

  it('approves multiple token allowances (single token repeated for test) with default owner', async () => {
    const params: z.infer<ReturnType<typeof approveTokenAllowanceParameters>> = {
      spenderAccountId: spenderAccountId.toString(),
      tokenApprovals: [
        { tokenId: tokenIdFT.toString(), amount: 1 },
        { tokenId: tokenIdFT.toString(), amount: 2 },
      ],
    };

    await wait(MIRROR_NODE_WAITING_TIME);

    const tool = approveTokenAllowanceTool(context);
    const result = await tool.execute(executorClient, context, params);

    expect(result.raw.status).toBe('SUCCESS');
    expect(result.raw.transactionId).toBeDefined();
  });
});
