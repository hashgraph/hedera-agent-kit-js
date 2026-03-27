import { describe, it, expect } from 'vitest';
import {
  HCS1_CHUNK_THRESHOLD,
  HCS1_CHUNK_ENVELOPE_SIZE,
  HCS1_CHUNK_SIZE,
  HCS2_PROTOCOL,
  HCS2_OPERATION,
} from '@/hooks/hol-audit-trail-hook/hol/constants';

describe('HOL Constants', () => {
  describe('HCS-1 constants', () => {
    it('should set HCS1_CHUNK_THRESHOLD to 1024', () => {
      expect(HCS1_CHUNK_THRESHOLD).toBe(1024);
    });

    it('should set HCS1_CHUNK_ENVELOPE_SIZE to 16', () => {
      expect(HCS1_CHUNK_ENVELOPE_SIZE).toBe(16);
    });

    it('should set HCS1_CHUNK_SIZE to HCS1_CHUNK_THRESHOLD minus HCS1_CHUNK_ENVELOPE_SIZE', () => {
      expect(HCS1_CHUNK_SIZE).toBe(HCS1_CHUNK_THRESHOLD - HCS1_CHUNK_ENVELOPE_SIZE);
      expect(HCS1_CHUNK_SIZE).toBe(1008);
    });
  });

  describe('HCS-2 constants', () => {
    it('should set HCS2_PROTOCOL to hcs-2', () => {
      expect(HCS2_PROTOCOL).toBe('hcs-2');
    });

    it('should define HCS2_OPERATION with register, update, delete, migrate', () => {
      expect(HCS2_OPERATION).toEqual({
        REGISTER: 'register',
        UPDATE: 'update',
        DELETE: 'delete',
        MIGRATE: 'migrate',
      });
    });
  });
});
