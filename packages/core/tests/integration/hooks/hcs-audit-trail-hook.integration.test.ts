import { describe, it, expect, beforeAll, vi } from 'vitest';
import { Context, AgentMode } from '@/shared';
import { HcsAuditTrailHook } from '@/hooks/hcs-audit-trail-hook';
import { getOperatorClientForTests } from '@hashgraph/hedera-agent-kit-tests';
import {
  Client,
  TopicCreateTransaction,
  AccountId,
  Timestamp,
  PublicKey,
  NftId,
} from '@hiero-ledger/sdk';
import getTransferHbarTool, {
  TRANSFER_HBAR_TOOL,
} from '@/plugins/core-account-plugin/tools/account/transfer-hbar';

describe('HcsAuditTrailHook Integration Tests', () => {
  let operatorClient: Client;
  let topicId: string;

  beforeAll(async () => {
    operatorClient = getOperatorClientForTests();

    // Create a temporary topic for testing
    const tx = await new TopicCreateTransaction().execute(operatorClient);
    const receipt = await tx.getReceipt(operatorClient);
    topicId = receipt.topicId!.toString();
  });

  it('should log tool execution to HCS successfully', async () => {
    const hook = new HcsAuditTrailHook([TRANSFER_HBAR_TOOL], topicId, operatorClient);
    const context: Context = {
      mode: AgentMode.AUTONOMOUS,
      hooks: [hook],
    };

    const tool = getTransferHbarTool(context);
    const params = {
      transfers: [{ accountId: operatorClient.operatorAccountId!.toString(), amount: 0.0001 }],
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
      accountId: operatorClient.operatorAccountId!.toString(),
    };

    const tool = getTransferHbarTool(context);
    const params = {
      transfers: [{ accountId: operatorClient.operatorAccountId!.toString(), amount: 0.0001 }],
    };

    const result = await tool.execute(operatorClient, context, params);
    expect(result.raw.error).toContain(
      'Unsupported hook: HcsAuditTrailHook is available only in Agent Mode AUTONOMOUS',
    );
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
