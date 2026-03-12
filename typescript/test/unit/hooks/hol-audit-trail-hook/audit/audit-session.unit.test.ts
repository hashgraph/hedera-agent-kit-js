import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuditSession } from '@/shared/hooks/hol-audit-trail-hook/audit/audit-session';
import type { AuditWriter, SessionAwareWriter } from '@/shared/hooks/hol-audit-trail-hook/audit/writers/types';
import type { AuditEntry } from '@/shared/hooks/hol-audit-trail-hook/audit/audit-entry';

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
      initialize: vi.fn().mockResolvedValue('0.0.999'),
      write: vi.fn().mockResolvedValue(undefined),
    };
  });

  it('should return null sessionId when constructed without sessionId', () => {
    const session = new AuditSession(mockWriter);
    expect(session.getSessionId()).toBeNull();
  });

  it('should return provided sessionId when constructed with one', () => {
    const session = new AuditSession(mockWriter, '0.0.666');
    expect(session.getSessionId()).toBe('0.0.666');
  });

  it('should initialize writer and write entry on first call', async () => {
    const session = new AuditSession(mockWriter);
    const entry = makeEntry();

    await session.writeEntry(entry);

    expect(mockWriter.initialize).toHaveBeenCalledTimes(1);
    expect(session.getSessionId()).toBe('0.0.999');
    expect(mockWriter.write).toHaveBeenCalledWith(entry);
  });

  it('should delegate write to writer with the provided entry', async () => {
    const session = new AuditSession(mockWriter);
    const entry = makeEntry();

    await session.writeEntry(entry);

    expect(mockWriter.write).toHaveBeenCalledTimes(1);
    expect(mockWriter.write).toHaveBeenCalledWith(entry);
  });

  it('should skip initialization when sessionId is provided at construction', async () => {
    const session = new AuditSession(mockWriter, '0.0.666');
    const entry = makeEntry();

    await session.writeEntry(entry);

    expect(mockWriter.initialize).not.toHaveBeenCalled();
    expect(session.getSessionId()).toBe('0.0.666');
    expect(mockWriter.write).toHaveBeenCalledWith(entry);
  });

  it('should initialize only once when multiple writeEntry calls are concurrent', async () => {
    (mockWriter.initialize as any).mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve('0.0.999'), 50);
        }),
    );

    const session = new AuditSession(mockWriter);
    const entry = makeEntry();

    await Promise.all([
      session.writeEntry(entry),
      session.writeEntry(entry),
      session.writeEntry(entry),
    ]);

    expect(mockWriter.initialize).toHaveBeenCalledTimes(1);
  });

  describe('with SessionAwareWriter', () => {
    let sessionAwareWriter: SessionAwareWriter;

    beforeEach(() => {
      sessionAwareWriter = {
        initialize: vi.fn().mockResolvedValue('0.0.999'),
        write: vi.fn().mockResolvedValue(undefined),
        setSessionId: vi.fn(),
      };
    });

    it('should call setSessionId on construction when sessionId is provided', () => {
      new AuditSession(sessionAwareWriter, '0.0.666');

      expect(sessionAwareWriter.setSessionId).toHaveBeenCalledTimes(1);
      expect(sessionAwareWriter.setSessionId).toHaveBeenCalledWith('0.0.666');
    });

    it('should not call setSessionId on construction when no sessionId is provided', () => {
      new AuditSession(sessionAwareWriter);

      expect(sessionAwareWriter.setSessionId).not.toHaveBeenCalled();
    });

    it('should call setSessionId after initialization completes', async () => {
      const session = new AuditSession(sessionAwareWriter);
      const entry = makeEntry();

      await session.writeEntry(entry);

      expect(sessionAwareWriter.setSessionId).toHaveBeenCalledTimes(1);
      expect(sessionAwareWriter.setSessionId).toHaveBeenCalledWith('0.0.999');
    });
  });

  it('should not call setSessionId on a plain AuditWriter after initialization', async () => {
    const session = new AuditSession(mockWriter);
    const entry = makeEntry();

    await session.writeEntry(entry);

    expect(mockWriter).not.toHaveProperty('setSessionId');
  });

  it('should propagate write errors', async () => {
    (mockWriter.write as any).mockRejectedValue(new Error('Write failed'));

    const session = new AuditSession(mockWriter);
    const entry = makeEntry();

    await expect(session.writeEntry(entry)).rejects.toThrow('Write failed');
  });

  it('should propagate initialization errors', async () => {
    (mockWriter.initialize as any).mockRejectedValue(new Error('Init failed'));

    const session = new AuditSession(mockWriter);
    const entry = makeEntry();

    await expect(session.writeEntry(entry)).rejects.toThrow('Init failed');
  });
});
