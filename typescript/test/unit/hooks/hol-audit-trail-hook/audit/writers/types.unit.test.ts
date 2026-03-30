import { describe, it, expect, vi } from 'vitest';
import { isSessionAware } from '@/hooks/hol-audit-trail-hook/audit/writers/types';
import type { AuditWriter, SessionAwareWriter } from '@/hooks/hol-audit-trail-hook/audit/writers/types';

describe('isSessionAware', () => {
  it('should return true for a writer with setSessionId method', () => {
    const writer: SessionAwareWriter = {
      write: vi.fn(),
      setSessionId: vi.fn(),
    };

    expect(isSessionAware(writer)).toBe(true);
  });

  it('should return false for a plain AuditWriter without setSessionId', () => {
    const writer: AuditWriter = {
      write: vi.fn(),
    };

    expect(isSessionAware(writer)).toBe(false);
  });
});
