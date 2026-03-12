import { describe, it, expect } from 'vitest';
import {
  HOL_AUDIT_ENTRY_VERSION,
  HOL_AUDIT_ENTRY_SOURCE,
  HOL_AUDIT_ENTRY_TYPE,
} from '@/shared/hooks/hol-audit-trail-hook/audit/constants';

describe('Audit Constants', () => {
  it('should export HOL_AUDIT_ENTRY_VERSION as 1.0', () => {
    expect(HOL_AUDIT_ENTRY_VERSION).toBe('1.0');
  });

  it('should export HOL_AUDIT_ENTRY_SOURCE as hedera-agent-kit-js', () => {
    expect(HOL_AUDIT_ENTRY_SOURCE).toBe('hedera-agent-kit-js');
  });

  it('should export HOL_AUDIT_ENTRY_TYPE as hedera-agent-kit:audit-entry', () => {
    expect(HOL_AUDIT_ENTRY_TYPE).toBe('hedera-agent-kit:audit-entry');
  });
});
