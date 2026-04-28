import { describe, expect, it } from 'vitest';
import { buildPrs } from '../src/engines/analytics';
import { formatTrainingVolume, formatWeight } from '../src/engines/unitConversionEngine';
import { makeSession } from './fixtures';

const lbSettings = { weightUnit: 'lb' as const };

describe('unit display consistency', () => {
  it('never shows unnecessary lb decimals', () => {
    expect(formatWeight(70.3523, lbSettings)).toBe('155lb');
    expect(formatWeight(20.4117, lbSettings)).toBe('45lb');
    expect(formatWeight(16, lbSettings)).toBe('35lb');
  });

  it('formats total volume in the user unit', () => {
    expect(formatTrainingVolume(100, lbSettings)).toBe('220lb');
    expect(formatTrainingVolume(100, { weightUnit: 'kg' })).toBe('100kg');
  });

  it('keeps PR raw values in kg while allowing UI formatters to show lb', () => {
    const session = makeSession({
      id: 'unit-pr',
      date: '2026-04-22',
      templateId: 'push-a',
      exerciseId: 'bench-press',
      setSpecs: [{ weight: 70.3523, reps: 5, rir: 2, techniqueQuality: 'good' }],
    });
    const pr = buildPrs([session]).find((item) => item.metric === 'max_weight');

    expect(pr?.raw).toBeCloseTo(70.3523);
    expect(formatWeight(pr?.raw, lbSettings)).toBe('155lb');
  });
});
