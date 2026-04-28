import { describe, expect, it } from 'vitest';
import { convertKgToDisplayWeight, convertLbToKg, formatTrainingVolume, formatWeight, parseDisplayWeightToKg } from '../src/engines/unitConversionEngine';

describe('unit conversion', () => {
  it('converts 100 lb to kg', () => {
    expect(convertLbToKg(100)).toBeCloseTo(45.4, 1);
  });

  it('does not change internal kg when formatting as lb', () => {
    const weightKg = 100;
    expect(convertKgToDisplayWeight(weightKg, 'lb')).toBe(220);
    expect(weightKg).toBe(100);
  });

  it('stores custom lb input as kg', () => {
    expect(parseDisplayWeightToKg(135, 'lb')).toBeCloseTo(61.2, 1);
  });

  it('formats display unit from settings', () => {
    expect(formatWeight(100, { weightUnit: 'lb' })).toBe('220lb');
    expect(formatWeight(100, { weightUnit: 'kg' })).toBe('100kg');
  });

  it('does not show unnecessary lb decimals', () => {
    expect(formatWeight(20.4117, { weightUnit: 'lb' })).toBe('45lb');
    expect(formatWeight(16, { weightUnit: 'lb' })).toBe('35lb');
  });

  it('formats training volume in selected unit', () => {
    expect(formatTrainingVolume(100, { weightUnit: 'lb' })).toBe('220lb');
    expect(formatTrainingVolume(100, { weightUnit: 'kg' })).toBe('100kg');
  });
});
