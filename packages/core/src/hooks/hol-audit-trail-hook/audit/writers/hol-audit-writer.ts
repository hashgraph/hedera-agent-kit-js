import { Client } from '@hiero-ledger/sdk';

import { Hcs1FileBuilder } from '@/hooks/hol-audit-trail-hook/hol/hcs1-file-builder';
import { Hcs2RegistryBuilder } from '@/hooks/hol-audit-trail-hook/hol/hcs2-registry-builder';
import type { AuditEntry } from '@/hooks/hol-audit-trail-hook/audit/audit-entry';
import type { SessionAwareWriter } from '@/hooks/hol-audit-trail-hook/audit/writers/types';

export class HolAuditWriter implements SessionAwareWriter {
  private client: Client;
  private sessionId!: string;

  constructor(client: Client) {
    this.client = client;
  }

  setSessionId(sessionId: string): void {
    this.sessionId = sessionId;
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
