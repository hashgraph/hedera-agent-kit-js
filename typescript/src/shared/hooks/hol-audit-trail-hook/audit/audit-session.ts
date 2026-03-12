import type { AuditEntry } from '@/shared/hooks/hol-audit-trail-hook/audit/audit-entry';
import type { AuditWriter } from '@/shared/hooks/hol-audit-trail-hook/audit/writers/types';
import { isSessionAware } from '@/shared/hooks/hol-audit-trail-hook/audit/writers/types';

export class AuditSession {
  private sessionId: string | null;
  private writer: AuditWriter;
  private initPromise: Promise<void> | null = null;

  constructor(writer: AuditWriter, sessionId?: string) {
    this.writer = writer;
    this.sessionId = sessionId ?? null;

    if (this.sessionId && isSessionAware(writer)) {
      writer.setSessionId(this.sessionId);
    }
  }

  getSessionId(): string | null {
    return this.sessionId;
  }

  async writeEntry(entry: AuditEntry): Promise<void> {
    await this.ensureInitialized();
    await this.writer.write(entry);
  }

  private async ensureInitialized(): Promise<void> {
    if (this.sessionId) return;

    if (!this.initPromise) {
      this.initPromise = this.initialize();
    }

    await this.initPromise;
  }

  private async initialize(): Promise<void> {
    this.sessionId = await this.writer.initialize();

    if (isSessionAware(this.writer)) {
      this.writer.setSessionId(this.sessionId);
    }
  }
}
