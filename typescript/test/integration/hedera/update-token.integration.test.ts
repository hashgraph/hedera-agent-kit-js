import { describe, it, expect, beforeEach, beforeAll, afterEach, afterAll } from 'vitest';
import {
  Client,
  PrivateKey,
  TokenId,
  TokenType,
  TokenSupplyType,
  AccountId,
  TopicId,
  PublicKey,
} from '@hashgraph/sdk';
import { Context, AgentMode } from '@/shared/configuration';
import updateTokenTool from '@/plugins/core-token-plugin/tools/update-token';
import { getOperatorClientForTests, getCustomClient, HederaOperationsWrapper } from '../../utils';
import { z } from 'zod';
import { updateTokenParameters } from '@/shared/parameter-schemas/token.zod';
import updateTopicTool from '@/plugins/core-consensus-plugin/tools/consensus/update-topic';
import { returnHbarsAndDeleteAccount } from '../../utils/teardown/account-teardown';
import { wait } from '../../utils/general-util';
import { MIRROR_NODE_WAITING_TIME } from '../../utils/test-constants';

describe('Update Token Integration Tests', () => {
  let operatorClient: Client;
  let operatorWrapper: HederaOperationsWrapper;
  let executorClient: Client;
  let executorWrapper: HederaOperationsWrapper;
  let executorAccountId: AccountId;
  let context: Context;
  let tokenId: TokenId;
  let topicId: TopicId;

  beforeAll(async () => {
    operatorClient = getOperatorClientForTests();
    operatorWrapper = new HederaOperationsWrapper(operatorClient);

    const executorKey = PrivateKey.generateED25519();
    executorAccountId = await operatorWrapper
      .createAccount({ key: executorKey.publicKey, initialBalance: 100 })
      .then(resp => resp.accountId!);

    executorClient = getCustomClient(executorAccountId, executorKey);
    executorWrapper = new HederaOperationsWrapper(executorClient);

    context = {
      mode: AgentMode.AUTONOMOUS,
      accountId: executorAccountId.toString(),
    };
  });

  beforeEach(async () => {
    const secondaryKey = PrivateKey.generateED25519().publicKey;
    const createTokenResult = await executorWrapper.createFungibleToken({
      tokenName: 'TestToken',
      tokenSymbol: 'TTN',
      tokenType: TokenType.FungibleCommon,
      supplyType: TokenSupplyType.Infinite,
      initialSupply: 1000,
      decimals: 0,
      treasuryAccountId: executorAccountId.toString(),
      adminKey: executorClient.operatorPublicKey!,
      supplyKey: executorClient.operatorPublicKey!,
      freezeKey: executorClient.operatorPublicKey!,
      kycKey: secondaryKey,
    });
    tokenId = createTokenResult.tokenId!;
    const createResult = await executorWrapper.createTopic({
      adminKey: executorClient.operatorPublicKey!,
      submitKey: executorClient.operatorPublicKey!,
      topicMemo: 'Initial topic memo',
      autoRenewAccountId: executorClient.operatorAccountId!.toString(),
      isSubmitKey: true,
    });

    topicId = createResult.topicId!;
    await wait(MIRROR_NODE_WAITING_TIME);
  });

  afterEach(async () => {
    if (tokenId) {
      try {
        await executorWrapper.deleteToken({ tokenId: tokenId.toString() });
      } catch (e) {
        console.warn(`Failed to delete token ${tokenId}: ${e}`);
      }
    }
    if (topicId) {
      try {
        await executorWrapper.deleteTopic({ topicId: topicId.toString() });
      } catch (e) {
        console.warn(`Failed to delete topic ${topicId}: ${e}`);
      }
    }
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


  it('updates token name, symbol, and memo', async () => {
    const tool = updateTokenTool(context);
    const params: z.infer<ReturnType<typeof updateTokenParameters>> = {
      tokenId: tokenId.toString(),
      tokenName: 'UpdatedTokenName',
      tokenSymbol: 'UTN',
      tokenMemo: 'Memo updated via integration test',
    } as any;

    const result: any = await tool.execute(executorClient, context, params);

    expect(result.humanMessage).toContain('Token successfully updated.');
    expect(result.raw.transactionId).toBeDefined();

    const info = await executorWrapper.getTokenInfo(tokenId.toString());
    expect(info?.name).toBe('UpdatedTokenName');
    expect(info?.symbol).toBe('UTN');
    expect(info?.tokenMemo).toBe('Memo updated via integration test');
  });

  // in this context the operator of an agent is the executor account created in the beforeAll
  // kyc key is previously set to some secondary key (in beforeEach) and now will be replaced by the executor key
  it('updates kycKey to operator key', async () => {
    const tool = updateTokenTool(context);
    const params = { tokenId: tokenId.toString(), kycKey: true } as any;

    const result: any = await tool.execute(executorClient, context, params);

    expect(result.humanMessage).toContain('Token successfully updated.');
    const info = await executorWrapper.getTokenInfo(tokenId.toString());
    expect(info?.adminKey?.toString()).toBe(executorClient.operatorPublicKey!.toString());
  });

  it('updates supplyKey to a new public key', async () => {
    const newSupplyKey = PrivateKey.generateED25519().publicKey.toString();
    const tool = updateTokenTool(context);
    const params = { tokenId: tokenId.toString(), supplyKey: newSupplyKey } as any;

    const result: any = await tool.execute(executorClient, context, params);

    expect(result.humanMessage).toContain('Token successfully updated.');
    const info = await executorWrapper.getTokenInfo(tokenId.toString());
    expect(info?.supplyKey?.toString()).toBe(newSupplyKey);
  });

  // removing existing keys is not possible, Hedera allows only updating existing keys
  it('sets freeze key to a dead key', async () => {
    const tool = updateTokenTool(context);
    const deadKey = '0x' + '0'.repeat(64); // 32-byte zero key in hex
    const params = { tokenId: tokenId.toString(), freezeKey: deadKey } as any;

    const result: any = await tool.execute(executorClient, context, params);

    expect(result.humanMessage).toContain('Token successfully updated.');
    const info = await executorWrapper.getTokenInfo(tokenId.toString());
    expect('0x' + (info?.freezeKey as PublicKey).toStringRaw()).toBe(deadKey);
  });

  it('fails if token did not originally have metadataKey', async () => {
    const tool = updateTokenTool(context);
    const params = { tokenId: tokenId.toString(), metadataKey: true } as any;

    const result: any = await tool.execute(executorClient, context, params);

    expect(result.humanMessage).toContain(
      'Failed to update token: Cannot update metadataKey: token was created without a metadataKey',
    );
  });

  it('fails with invalid token ID', async () => {
    const tool = updateTokenTool(context);
    const params = { tokenId: '0.0.999999999', tokenName: 'Invalid Token' } as any;

    const result: any = await tool.execute(executorClient, context, params);

    expect(result.humanMessage).toContain('Failed to update token:');
    expect(result.humanMessage).toContain('Not Found');
  });

  it('fails with too long token name', async () => {
    const tool = updateTokenTool(context);
    const params: z.infer<ReturnType<typeof updateTokenParameters>> = {
      tokenId: tokenId.toString(),
      tokenName: 'UpdatedTokenName'.repeat(30),
    } as any;

    const result: any = await tool.execute(executorClient, context, params);

    expect(result.humanMessage).toContain(
      'Invalid parameters: Field "tokenName" - String must contain at most 100 character(s)',
    );
    expect(result.raw.error).toContain(
      'Invalid parameters: Field "tokenName" - String must contain at most 100 character(s)',
    );
  });

  it('updates topic memo', async () => {
    const tool = updateTopicTool(context);
    const params = { topicId: topicId.toString(), topicMemo: 'Updated memo via integration test' };

    const result: any = await tool.execute(executorClient, context, params);

    expect(result.humanMessage).toContain('Topic successfully updated.');
    expect(result.raw.transactionId).toBeDefined();

    const info = await executorWrapper.getTopicInfo(topicId.toString());
    expect(info?.topicMemo).toBe('Updated memo via integration test');
  });

  it('updates submitKey to operator key', async () => {
    const tool = updateTopicTool(context);
    const params = { topicId: topicId.toString(), submitKey: true };

    const result: any = await tool.execute(executorClient, context, params);
    expect(result.humanMessage).toContain('Topic successfully updated.');

    const info = await executorWrapper.getTopicInfo(topicId.toString());
    expect(info?.submitKey?.toString()).toBe(executorClient.operatorPublicKey!.toString());
  });

  it('updates submitKey to a new public key', async () => {
    const newKey = PrivateKey.generateED25519().publicKey;
    const tool = updateTopicTool(context);
    const params = { topicId: topicId.toString(), submitKey: newKey.toString() };

    const result: any = await tool.execute(executorClient, context, params);
    expect(result.humanMessage).toContain('Topic successfully updated.');

    const info = await executorWrapper.getTopicInfo(topicId.toString());
    expect(info?.submitKey?.toString()).toBe(newKey.toString());
  });

  it('updates autoRenewAccountId, autoRenewPeriod, and extends expirationTime', async () => {
    const tool = updateTopicTool(context);

    // Fetch current topic info
    const currentInfo = await executorWrapper.getTopicInfo(topicId.toString());
    expect(currentInfo?.expirationTime).not.toBeNull();

    // Extend expiration by 48 hours from the current expiration
    const currentExpirationMillis =
      currentInfo!.expirationTime!.seconds.toNumber() * 1000 +
      Math.floor(currentInfo!.expirationTime!.nanos.toNumber() / 1e6);
    const newExpirationDate = new Date(currentExpirationMillis + 48 * 3600 * 1000); // +48h
    const newExpirationISO = newExpirationDate.toISOString();

    const newAutoRenewPeriod = 30 * 24 * 3600; // 30 days

    const params = {
      topicId: topicId.toString(),
      autoRenewAccountId: executorClient.operatorAccountId!.toString(),
      autoRenewPeriod: newAutoRenewPeriod,
      expirationTime: newExpirationDate,
    };

    const result: any = await tool.execute(executorClient, context, params);

    expect(result.humanMessage).toContain('Topic successfully updated.');
    expect(result.raw.transactionId).toBeDefined();

    const updatedInfo = await executorWrapper.getTopicInfo(topicId.toString());
    expect(updatedInfo?.autoRenewAccountId?.toString()).toBe(
      executorClient.operatorAccountId!.toString(),
    );
    expect(updatedInfo?.autoRenewPeriod?.seconds.toString()).toBe(newAutoRenewPeriod.toString());

    const expirationTimeMillis =
      updatedInfo!.expirationTime!.seconds.toNumber() * 1000 +
      Math.floor(updatedInfo!.expirationTime!.nanos.toNumber() / 1e6);
    expect(new Date(expirationTimeMillis).toISOString()).toBe(newExpirationISO);
  });

  it('fails if trying to set submitKey when topic was created without one', async () => {
    // Delete the existing topic and recreate without a submitKey
    await executorWrapper.deleteTopic({ topicId: topicId.toString() });
    const createResult = await executorWrapper.createTopic({
      adminKey: executorClient.operatorPublicKey!,
      topicMemo: 'No submitKey topic',
      autoRenewAccountId: executorClient.operatorAccountId!.toString(),
      isSubmitKey: true,
    });
    topicId = createResult.topicId!;
    await wait(MIRROR_NODE_WAITING_TIME);

    const tool = updateTopicTool(context);
    const params = { topicId: topicId.toString(), submitKey: true };

    const result: any = await tool.execute(executorClient, context, params);
    expect(result.humanMessage).toContain('Failed to update topic: Cannot update submitKey');
  });

  it('fails with invalid topic ID', async () => {
    const tool = updateTopicTool(context);
    const params = { topicId: '0.0.999999999', topicMemo: 'Invalid topic' };

    const result: any = await tool.execute(executorClient, context, params);
    expect(result.humanMessage).toContain('Failed to update topic:');

  });
});

