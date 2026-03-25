import type { AuditEntry } from '@/hooks/hol-audit-trail-hook/audit/audit-entry';
import type { AuditWriter } from '@/hooks/hol-audit-trail-hook/audit/writers/types';
import { isSessionAware } from '@/hooks/hol-audit-trail-hook/audit/writers/types';

export class AuditSession {
  private sessionId: string;
  private writer: AuditWriter;

  constructor(writer: AuditWriter, sessionId: string) {
    this.writer = writer;
    this.sessionId = sessionId;

    if (isSessionAware(writer)) {
      writer.setSessionId(this.sessionId);
    }
  }

  getSessionId(): string {
    return this.sessionId;
  }

  async writeEntry(entry: AuditEntry): Promise<void> {
    await this.writer.write(entry);
  }
}
