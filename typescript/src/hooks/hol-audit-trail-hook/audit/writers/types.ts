import type { AuditEntry } from '@/hooks/hol-audit-trail-hook/audit/audit-entry';

export type AuditWriter = {
  /** Write a single audit entry. */
  write(entry: AuditEntry): Promise<void>;
};

export type SessionAwareWriter = AuditWriter & {
  setSessionId(sessionId: string): void;
};

export function isSessionAware(writer: AuditWriter): writer is SessionAwareWriter {
  return 'setSessionId' in writer;
}
