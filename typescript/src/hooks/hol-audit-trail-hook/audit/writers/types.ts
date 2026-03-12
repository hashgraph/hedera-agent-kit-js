import type { AuditEntry } from '@/hooks/hol-audit-trail-hook/audit/audit-entry';

export type AuditWriter = {
  /** One-time setup: create resources (e.g. registry topic). Returns session identifier. */
  initialize(): Promise<string>;
  /** Write a single audit entry. */
  write(entry: AuditEntry): Promise<void>;
};

export type SessionAwareWriter = AuditWriter & {
  setSessionId(sessionId: string): void;
};

export function isSessionAware(writer: AuditWriter): writer is SessionAwareWriter {
  return 'setSessionId' in writer;
}
