import { describe, it, expect, beforeAll } from 'vitest';
import { Context, AgentMode } from '@/shared';
import { HcsAuditTrailHook } from '@/shared/hooks/hcs-audit-trail-hook';
import { getOperatorClientForTests } from '../../utils';
import { Client, TopicCreateTransaction } from '@hashgraph/sdk';
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

  it('should skip logging in RETURN_BYTES mode', async () => {
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

    expect(result.bytes).toBeDefined();
  });
});
