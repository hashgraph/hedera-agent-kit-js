import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { Context, AgentMode } from '@/shared';
import { HcsAuditTrailHook } from '@/hooks/hcs-audit-trail-hook';
import { getProfile } from '@hashgraph/hedera-agent-kit-tests';
import {
  Client,
  TopicCreateTransaction,
  Transaction,
  AccountId,
  Timestamp,
  PublicKey,
  NftId,
} from '@hiero-ledger/sdk';
import getTransferHbarTool, {
  TRANSFER_HBAR_TOOL,
} from '@/plugins/core-account-plugin/tools/account/transfer-hbar';
import {
  ExecuteStrategy,
  RawTransactionResponse,
  TransactionStrategy,
} from '@/shared/strategies/tx-mode-strategy';

describe('HcsAuditTrailHook Integration Tests', () => {
  const profile = getProfile();
  let operatorClient: Client;
  let topicId: string;

  beforeAll(async () => {
    ({ client: operatorClient } = profile.client.connectAs(profile.operator));

    // Create a temporary topic for testing
    const tx = await new TopicCreateTransaction().execute(operatorClient);
    const receipt = await tx.getReceipt(operatorClient);
    topicId = receipt.topicId!.toString();
  });

  afterAll(() => {
    operatorClient?.close();
  });

  it('should log tool execution to HCS successfully', async () => {
    const hook = new HcsAuditTrailHook([TRANSFER_HBAR_TOOL], topicId, operatorClient);
    const context: Context = {
      mode: AgentMode.AUTONOMOUS,
      hooks: [hook],
    };

    const tool = getTransferHbarTool(context);
    const params = {
      transfers: [{ accountId: profile.operator.accountId.toString(), amount: 0.0001 }],
    };

    const result = await tool.execute(operatorClient, context, params);

    expect(result.raw.status).toBe('SUCCESS');
    expect(result.raw.transactionId).toBeDefined();
  });

  it('should stop execution in RETURN_BYTES mode', async () => {
    const hook = new HcsAuditTrailHook([TRANSFER_HBAR_TOOL], topicId, operatorClient);
    const context: Context = {
      mode: AgentMode.RETURN_BYTES,
      hooks: [hook],
      accountId: profile.operator.accountId.toString(),
    };

    const tool = getTransferHbarTool(context);
    const params = {
      transfers: [{ accountId: profile.operator.accountId.toString(), amount: 0.0001 }],
    };

    const result = await tool.execute(operatorClient, context, params);
    expect(result.raw.error).toContain(
      'Unsupported hook: HcsAuditTrailHook does not support AgentMode.RETURN_BYTES',
    );
  });

  it('should log tool execution in CUSTOM mode', async () => {
    const hook = new HcsAuditTrailHook([TRANSFER_HBAR_TOOL], topicId, operatorClient);

    class PassthroughStrategy implements TransactionStrategy {
      private inner = new ExecuteStrategy();
      async handle(tx: Transaction, client: Client, context: Context, postProcess?: (r: RawTransactionResponse) => string) {
        return this.inner.handle(tx, client, context, postProcess);
      }
    }

    const postMessageSpy = vi
      .spyOn(hook, 'postMessageToHcsTopic')
      .mockImplementation(async () => {});

    const context: Context = {
      mode: AgentMode.CUSTOM_EXECUTE_TX,
      hooks: [hook],
      accountId: profile.operator.accountId.toString(),
      transactionStrategy: new PassthroughStrategy(),
    };

    const tool = getTransferHbarTool(context);
    const params = {
      transfers: [{ accountId: profile.operator.accountId.toString(), amount: 0.0001 }],
    };

    const result = await tool.execute(operatorClient, context, params);

    expect(result.raw.status).toBe('SUCCESS');
    expect(postMessageSpy).toHaveBeenCalledTimes(1);
    expect(postMessageSpy.mock.calls[0][0]).toContain(`Agent executed tool ${TRANSFER_HBAR_TOOL}`);
  });

  it('should correctly stringify real SDK classes in nested parameters', async () => {
    const hook = new HcsAuditTrailHook([TRANSFER_HBAR_TOOL], topicId, operatorClient);

    // Spy on the private submission method to capture the message
    const postMessageSpy = vi
      .spyOn(hook as any, 'postMessageToHcsTopic')
      .mockImplementation(async () => {});

    const context: Context = { mode: AgentMode.AUTONOMOUS };
    const params = {
      normalisedParams: {
        context: context,
        transactionMemo: 'integration stringification',
        schedulingParams: {
          isScheduled: true,
          payerAccountID: AccountId.fromString('0.0.123'),
          expirationTime: Timestamp.fromDate(new Date('2026-03-09T12:00:00Z')),
          adminKey: PublicKey.fromString(
            '302a300506032b6570032100e0c8ec2758a5879ffac226a13c0c516b97d158b9d1461269c81250619932170b',
          ),
        },
        hbarTransfers: [{ accountId: AccountId.fromString('0.0.456'), amount: 100 }],
        transfers: [
          {
            nftId: NftId.fromString('0.0.789@1'),
            receiver: AccountId.fromString('0.0.101'),
          },
        ],
        functionParameters: new Uint8Array([1, 2, 3, 255]),
      },
      toolResult: {
        raw: {
          transactionId: '0.0.1@123',
          status: 'SUCCESS',
        } as any,
      },
    } as any;

    await hook.postToolExecutionHook(params, TRANSFER_HBAR_TOOL);

    expect(postMessageSpy).toHaveBeenCalled();
    const message = postMessageSpy.mock.calls[0][0] as string;
    const parsedParams = JSON.parse(message.match(/with params (\{[\s\S]*?})\./)![1]);

    expect(parsedParams.transactionMemo).toBe('integration stringification');
    expect(parsedParams.schedulingParams.payerAccountID).toBe('0.0.123');
    expect(parsedParams.schedulingParams.adminKey).toBe(
      '302a300506032b6570032100e0c8ec2758a5879ffac226a13c0c516b97d158b9d1461269c81250619932170b',
    );
    // Hedera SDK Timestamp.toString() returns seconds.nanos
    expect(parsedParams.schedulingParams.expirationTime).toBe('1773057600.000000000');
    expect(parsedParams.hbarTransfers[0].accountId).toBe('0.0.456');
    expect(parsedParams.transfers[0].nftId).toBe('0.0.789/1');
    expect(parsedParams.transfers[0].receiver).toBe('0.0.101');
    expect(parsedParams.functionParameters).toBe('0x010203ff');
  });
});
