import { describe, it, expect } from 'vitest';
import BigNumber from 'bignumber.js';
import { toBaseUnit, toDisplayUnit } from '@/shared/hedera-utils/decimals-utils';

describe('decimals-utils', () => {
  describe('toBaseUnit', () => {
    it('converts human-readable number to base units using floor', () => {
      expect(toBaseUnit(1, 8).isEqualTo(100000000)).toBe(true);
      expect(toBaseUnit(1.5, 8).isEqualTo(150000000)).toBe(true);
      // ensure floor behavior
      expect(toBaseUnit(0.123456789, 8).isEqualTo(12345678)).toBe(true);
    });

    it('converts human-readable BigNumber to base units using floor', () => {
      expect(toBaseUnit(new BigNumber(1), 8).isEqualTo(100000000)).toBe(true);
      expect(toBaseUnit(new BigNumber(1.5), 8).isEqualTo(150000000)).toBe(true);
      // ensure floor behavior
      expect(toBaseUnit(new BigNumber(0.123456789), 8).isEqualTo(12345678)).toBe(true);
    });

    it('handles edge cases', () => {
      expect(toBaseUnit(0, 8).isEqualTo(0)).toBe(true);
      expect(toBaseUnit(new BigNumber(0), 8).isEqualTo(0)).toBe(true);
    });
  });

  describe('toDisplayUnit', () => {
    it('converts base units number to human-readable', () => {
      expect(toDisplayUnit(150000000, 8).isEqualTo(1.5)).toBe(true);
      expect(toDisplayUnit(1, 0).isEqualTo(1)).toBe(true);
      expect(toDisplayUnit(0, 8).isEqualTo(0)).toBe(true);
    });

    it('converts base units BigNumber to human-readable', () => {
      expect(toDisplayUnit(new BigNumber(150000000), 8).isEqualTo(1.5)).toBe(true);
      expect(toDisplayUnit(new BigNumber(1), 0).isEqualTo(1)).toBe(true);
      expect(toDisplayUnit(new BigNumber(0), 8).isEqualTo(0)).toBe(true);
    });
  });

  describe('round trip precision', () => {
    it('loses sub-decimal beyond precision due to floor behavior with numbers', () => {
      const decimals = 6;
      const amount = 1.23456789; // more precision than decimals
      const base = toBaseUnit(amount, decimals);
      const display = toDisplayUnit(base, decimals);
      expect(display.isEqualTo(new BigNumber(1.234567))).toBe(true);
    });

    it('loses sub-decimal beyond precision due to floor behavior with BigNumbers', () => {
      const decimals = 6;
      const amount = new BigNumber(1.23456789); // more precision than decimals
      const base = toBaseUnit(amount, decimals);
      const display = toDisplayUnit(base, decimals);
      expect(display.isEqualTo(new BigNumber(1.234567))).toBe(true);
    });

    it('maintains precision for exact decimal values', () => {
      const decimals = 8;
      const amount = 1.5; // exact decimal
      const base = toBaseUnit(amount, decimals);
      const display = toDisplayUnit(base, decimals);
      expect(display.isEqualTo(new BigNumber(1.5))).toBe(true);
    });
  });

  describe('HBAR specific tests (8 decimals)', () => {
    it('handles typical HBAR amounts correctly', () => {
      // 1 HBAR = 100,000,000 tinybars
      expect(toBaseUnit(1, 8).isEqualTo(100000000)).toBe(true);
      expect(toDisplayUnit(100000000, 8).isEqualTo(1)).toBe(true);

      // 0.1 HBAR = 10,000,000 tinybars
      expect(toBaseUnit(0.1, 8).isEqualTo(10000000)).toBe(true);
      expect(toDisplayUnit(10000000, 8).isEqualTo(0.1)).toBe(true);

      // 1 tinybar = 0.00000001 HBAR
      expect(toDisplayUnit(1, 8).isEqualTo(0.00000001)).toBe(true);
      expect(toBaseUnit(0.00000001, 8).isEqualTo(1)).toBe(true);
    });
  });
});
