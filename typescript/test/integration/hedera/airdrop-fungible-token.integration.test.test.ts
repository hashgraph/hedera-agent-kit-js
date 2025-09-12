import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client, PrivateKey, AccountId, PublicKey, TokenId, TokenSupplyType } from '@hashgraph/sdk';
import airdropFungibleTokenTool from '@/plugins/core-token-plugin/tools/fungible-token/airdrop-fungible-token';
import { Context, AgentMode } from '@/shared/configuration';
import { getOperatorClientForTests, getCustomClient, HederaOperationsWrapper } from '../../utils';
import { z } from 'zod';
import { airdropFungibleTokenParameters } from '@/shared/parameter-schemas/token.zod';
import { wait } from '../../utils/general-util';
import { returnHbarsAndDeleteAccount } from '../../utils/teardown/account-teardown';
import { MIRROR_NODE_WAITING_TIME } from '../../utils/test-constants';

describe('Airdrop Fungible Token Integration Tests', () => {
  let operatorClient: Client;
  let executorClient: Client;
  let executorAccountId: AccountId;
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
    operatorClient = getOperatorClientForTests();
    const operatorWrapper = new HederaOperationsWrapper(operatorClient);

    const executorKey = PrivateKey.generateED25519();
    executorAccountId = await operatorWrapper
      .createAccount({ key: executorKey.publicKey, initialBalance: 25 })
      .then(resp => resp.accountId!);

    executorClient = getCustomClient(executorAccountId, executorKey);
    executorWrapper = new HederaOperationsWrapper(executorClient);

    context = {
      mode: AgentMode.AUTONOMOUS,
      accountId: executorClient.operatorAccountId!.toString(),
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
    if (executorClient && operatorClient) {
      await returnHbarsAndDeleteAccount(
        executorWrapper,
        executorAccountId,
        operatorClient.operatorAccountId!,
      );
      executorClient.close();
      operatorClient.close();
    }
  });

  const createRecipientAccount = async (maxAutomaticTokenAssociations: number) => {
    const recipientKey = PrivateKey.generateED25519();
    const recipientId = await executorWrapper
      .createAccount({
        key: recipientKey.publicKey,
        initialBalance: 0,
        maxAutomaticTokenAssociations,
      })
      .then(resp => resp.accountId!);

    const recipientClient = getCustomClient(recipientId, recipientKey);
    const recipientWrapper = new HederaOperationsWrapper(recipientClient);

    return { recipientId, recipientClient, recipientWrapper };
  };

  it('should airdrop tokens to a single recipient', async () => {
    const { recipientId, recipientClient } = await createRecipientAccount(0); // no automatic token associations

    const tool = airdropFungibleTokenTool(context);
    const params: z.infer<ReturnType<typeof airdropFungibleTokenParameters>> = {
      tokenId: tokenIdFT.toString(),
      sourceAccountId: executorAccountId.toString(),
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
      sourceAccountId: executorAccountId.toString(),
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
      sourceAccountId: executorAccountId.toString(),
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
      sourceAccountId: executorAccountId.toString(),
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
      sourceAccountId: executorAccountId.toString(),
      recipients: [{ accountId: recipientId.toString(), amount: 25 }],
    };

    const result: any = await tool.execute(executorClient, context, params);
    await wait(MIRROR_NODE_WAITING_TIME);

    expect(result.raw.status).toBe('SUCCESS');

    const outstanding = await executorWrapper.getOutstandingAirdrops(executorAccountId.toString());
    expect(outstanding.airdrops.some(a => a.token_id === tokenIdFT.toString())).toBe(true);

    recipientClient.close();
  });
});
