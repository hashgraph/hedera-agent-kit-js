import { Client } from '@hashgraph/sdk';

import { Hcs1FileBuilder } from '@/shared/hooks/hol-audit-trail-hook/hol/hcs1-file-builder';
import { Hcs2RegistryBuilder } from '@/shared/hooks/hol-audit-trail-hook/hol/hcs2-registry-builder';
import { HCS2_REGISTRY_TYPE } from '@/shared/hooks/hol-audit-trail-hook/hol/constants';
import type { AuditEntry } from '@/shared/hooks/hol-audit-trail-hook/audit/audit-entry';
import type { SessionAwareWriter } from '@/shared/hooks/hol-audit-trail-hook/audit/writers/types';

export class HolAuditWriter implements SessionAwareWriter {
  private client: Client;
  private sessionId!: string;

  constructor(client: Client) {
    this.client = client;
  }

  setSessionId(sessionId: string): void {
    this.sessionId = sessionId;
  }

  async initialize(): Promise<string> {
    const tx = Hcs2RegistryBuilder.createRegistry({
      autoRenewAccountId: this.client.operatorAccountId!.toString(),
      submitKey: this.client.operatorPublicKey!,
      registryType: HCS2_REGISTRY_TYPE.INDEXED,
      ttl: 0,
    });

    const response = await tx.execute(this.client);
    const receipt = await response.getReceipt(this.client);
    if (!receipt.topicId) {
      throw new Error('Failed to create session topic');
    }

    return receipt.topicId.toString();
  }

  async write(entry: AuditEntry): Promise<void> {
    const { topicTransaction, buildMessageTransactions } = Hcs1FileBuilder.createFile({
      autoRenewAccountId: this.client.operatorAccountId!.toString(),
      submitKey: this.client.operatorPublicKey!,
      content: JSON.stringify(entry),
    });

    const topicResponse = await topicTransaction.execute(this.client);
    const topicReceipt = await topicResponse.getReceipt(this.client);
    if (!topicReceipt.topicId) {
      throw new Error('Failed to create HCS-1 topic for audit entry');
    }
    const entryTopicId = topicReceipt.topicId.toString();

    const messageTxs = buildMessageTransactions(entryTopicId);
    for (const messageTx of messageTxs) {
      await messageTx.execute(this.client);
    }

    const registerTx = Hcs2RegistryBuilder.registerEntry({
      registryTopicId: this.sessionId,
      targetTopicId: entryTopicId,
    });

    await registerTx.execute(this.client);
  }
}
