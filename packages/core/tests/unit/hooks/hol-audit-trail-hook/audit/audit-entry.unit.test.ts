import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildAuditEntry, auditEntrySchema } from '@/hooks/hol-audit-trail-hook/audit/audit-entry';
import {
  HOL_AUDIT_ENTRY_TYPE,
  HOL_AUDIT_ENTRY_VERSION,
  HOL_AUDIT_ENTRY_SOURCE,
} from '@/hooks/hol-audit-trail-hook/audit/constants';

describe('buildAuditEntry', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should build a valid audit entry with all fields provided', () => {
    const entry = buildAuditEntry({
      tool: 'transfer_hbar',
      params: { amount: 100, to: '0.0.456' },
      result: {
        raw: { status: 'SUCCESS', transactionId: '0.0.1@123' },
        message: 'Transfer of 100 HBAR succeeded',
      },
    });

    expect(entry.type).toBe(HOL_AUDIT_ENTRY_TYPE);
    expect(entry.version).toBe(HOL_AUDIT_ENTRY_VERSION);
    expect(entry.source).toBe(HOL_AUDIT_ENTRY_SOURCE);
    expect(entry.tool).toBe('transfer_hbar');
    expect(entry.params).toEqual({ amount: 100, to: '0.0.456' });
    expect(entry.result.raw).toEqual({ status: 'SUCCESS', transactionId: '0.0.1@123' });
    expect(entry.result.message).toBe('Transfer of 100 HBAR succeeded');
  });

  it('should produce entries that pass auditEntrySchema Zod validation', () => {
    const entry = buildAuditEntry({
      tool: 'create_token',
      params: { name: 'Test Token' },
      result: {
        raw: { tokenId: '0.0.789' },
        message: 'Token created',
      },
    });

    expect(() => auditEntrySchema.parse(entry)).not.toThrow();
  });

  it('should set type to HOL_AUDIT_ENTRY_TYPE constant', () => {
    const entry = buildAuditEntry({ tool: 'test_tool' });
    expect(entry.type).toBe(HOL_AUDIT_ENTRY_TYPE);
  });

  it('should set version to HOL_AUDIT_ENTRY_VERSION constant', () => {
    const entry = buildAuditEntry({ tool: 'test_tool' });
    expect(entry.version).toBe(HOL_AUDIT_ENTRY_VERSION);
  });

  it('should set source to HOL_AUDIT_ENTRY_SOURCE constant', () => {
    const entry = buildAuditEntry({ tool: 'test_tool' });
    expect(entry.source).toBe(HOL_AUDIT_ENTRY_SOURCE);
  });

  it('should set timestamp as ISO 8601 string', () => {
    const before = new Date().toISOString();
    const entry = buildAuditEntry({ tool: 'test_tool' });
    const after = new Date().toISOString();

    expect(entry.timestamp >= before).toBe(true);
    expect(entry.timestamp <= after).toBe(true);
    expect(new Date(entry.timestamp).toISOString()).toBe(entry.timestamp);
  });

  it('should default params to empty object when not provided', () => {
    const entry = buildAuditEntry({ tool: 'test_tool' });
    expect(entry.params).toEqual({});
  });

  it('should default result.raw to empty object when result is undefined', () => {
    const entry = buildAuditEntry({ tool: 'test_tool' });
    expect(entry.result.raw).toEqual({});
  });

  it('should default result.message to null when result is undefined', () => {
    const entry = buildAuditEntry({ tool: 'test_tool' });
    expect(entry.result.message).toBeNull();
  });

  it('should default result.raw to empty object when result is provided but raw is undefined', () => {
    const entry = buildAuditEntry({
      tool: 'test_tool',
      result: { message: 'some message' },
    });
    expect(entry.result.raw).toEqual({});
  });

  it('should default result.message to null when result is provided but message is undefined', () => {
    const entry = buildAuditEntry({
      tool: 'test_tool',
      result: { raw: { foo: 'bar' } },
    });
    expect(entry.result.message).toBeNull();
  });
});

describe('auditEntrySchema', () => {
  it('should accept a valid audit entry', () => {
    const entry = buildAuditEntry({
      tool: 'test_tool',
      params: { key: 'value' },
      result: { raw: { status: 'OK' }, message: 'done' },
    });

    expect(() => auditEntrySchema.parse(entry)).not.toThrow();
  });

  it('should reject entry with wrong type literal', () => {
    const entry = {
      ...buildAuditEntry({ tool: 'test_tool' }),
      type: 'wrong-type',
    };

    expect(() => auditEntrySchema.parse(entry)).toThrow();
  });

  it('should reject entry with wrong version literal', () => {
    const entry = {
      ...buildAuditEntry({ tool: 'test_tool' }),
      version: '2.0',
    };

    expect(() => auditEntrySchema.parse(entry)).toThrow();
  });

  it('should reject entry with missing tool field', () => {
    const entry = buildAuditEntry({ tool: 'test_tool' });
    const { tool, ...withoutTool } = entry;

    expect(() => auditEntrySchema.parse(withoutTool)).toThrow();
  });
});
