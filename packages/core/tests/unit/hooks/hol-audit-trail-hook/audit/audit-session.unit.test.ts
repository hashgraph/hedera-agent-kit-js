import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuditSession } from '@/hooks/hol-audit-trail-hook/audit/audit-session';
import type { AuditWriter, SessionAwareWriter } from '@/hooks/hol-audit-trail-hook/audit/writers/types';
import type { AuditEntry } from '@/hooks/hol-audit-trail-hook/audit/audit-entry';

const makeEntry = (tool = 'test_tool'): AuditEntry => ({
  type: 'hedera-agent-kit:audit-entry',
  version: '1.0',
  source: 'hedera-agent-kit-js',
  timestamp: new Date().toISOString(),
  tool,
  params: { amount: 100 },
  result: { raw: { status: 'SUCCESS' }, message: 'ok' },
});

describe('AuditSession', () => {
  let mockWriter: AuditWriter;

  beforeEach(() => {
    mockWriter = {
      write: vi.fn().mockResolvedValue(undefined),
    };
  });

  it('should return provided sessionId', () => {
    const session = new AuditSession(mockWriter, '0.0.666');
    expect(session.getSessionId()).toBe('0.0.666');
  });

  it('should delegate write to writer with the provided entry', async () => {
    const session = new AuditSession(mockWriter, '0.0.666');
    const entry = makeEntry();

    await session.writeEntry(entry);

    expect(mockWriter.write).toHaveBeenCalledTimes(1);
    expect(mockWriter.write).toHaveBeenCalledWith(entry);
  });

  describe('with SessionAwareWriter', () => {
    let sessionAwareWriter: SessionAwareWriter;

    beforeEach(() => {
      sessionAwareWriter = {
        write: vi.fn().mockResolvedValue(undefined),
        setSessionId: vi.fn(),
      };
    });

    it('should call setSessionId on construction', () => {
      new AuditSession(sessionAwareWriter, '0.0.666');

      expect(sessionAwareWriter.setSessionId).toHaveBeenCalledTimes(1);
      expect(sessionAwareWriter.setSessionId).toHaveBeenCalledWith('0.0.666');
    });

    it('should not call setSessionId on a plain AuditWriter', () => {
      new AuditSession(mockWriter, '0.0.666');

      expect(mockWriter).not.toHaveProperty('setSessionId');
    });
  });

  it('should propagate write errors', async () => {
    (mockWriter.write as any).mockRejectedValue(new Error('Write failed'));

    const session = new AuditSession(mockWriter, '0.0.666');
    const entry = makeEntry();

    await expect(session.writeEntry(entry)).rejects.toThrow('Write failed');
  });
});
