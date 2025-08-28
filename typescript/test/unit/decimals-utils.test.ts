import { describe, it, expect } from 'vitest';
import { toBaseUnit, toDisplayUnit } from '../../src/shared/hedera-utils/decimals-utils';


describe('decimals-utils', () => {
  it('toBaseUnit converts human-readable to base units using floor', () => {
    expect(toBaseUnit(1, 8)).toBe(100000000);
    expect(toBaseUnit(1.5, 8)).toBe(150000000);
    // ensure floor behavior
    expect(toBaseUnit(0.123456789, 8)).toBe(12345678);
  });

  it('toDisplayUnit converts base units to human-readable', () => {
    expect(toDisplayUnit(150000000, 8)).toBe(1.5);
    expect(toDisplayUnit(1, 0)).toBe(1);
  });

  it('round trip within precision loses sub-decimal beyond precision (due to floor)', () => {
    const decimals = 6;
    const amount = 1.23456789; // more precision than decimals
    const base = toBaseUnit(amount, decimals);
    const display = toDisplayUnit(base, decimals);
    expect(display).toBeCloseTo(1.234567, 6);
  });
});
