import { describe, expect, it } from 'vitest';
import { convertKgToDisplayWeight, convertLbToKg, formatWeight, parseDisplayWeightToKg } from '../src/engines/unitConversionEngine';

describe('unit conversion', () => {
  it('converts 100 lb to kg', () => {
    expect(convertLbToKg(100)).toBeCloseTo(45.4, 1);
  });

  it('does not change internal kg when formatting as lb', () => {
    const weightKg = 100;
    expect(convertKgToDisplayWeight(weightKg, 'lb')).toBeCloseTo(220.5, 1);
    expect(weightKg).toBe(100);
  });

  it('stores custom lb input as kg', () => {
    expect(parseDisplayWeightToKg(135, 'lb')).toBeCloseTo(61.2, 1);
  });

  it('formats display unit from settings', () => {
    expect(formatWeight(100, { weightUnit: 'lb' })).toBe('220.5lb');
    expect(formatWeight(100, { weightUnit: 'kg' })).toBe('100kg');
  });
});
