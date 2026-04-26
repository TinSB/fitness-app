import { describe, expect, it } from 'vitest';
import { DEFAULT_PROGRAM_TEMPLATE } from '../src/data/trainingData';
import { buildAdherenceAdjustment } from '../src/engines/adherenceAdjustmentEngine';
import type { AdherenceReport } from '../src/models/training-model';

const makeReport = (overrides: Partial<AdherenceReport> = {}): AdherenceReport => ({
  recentSessionCount: 6,
  plannedSets: 60,
  actualSets: 54,
  overallRate: 90,
  mainlineRate: 88,
  correctionRate: 82,
  functionalRate: 80,
  recentSessions: [],
  skippedExercises: [],
  skippedSupportExercises: [],
  suggestions: [],
  confidence: 'high',
  ...overrides,
});

describe('adherenceAdjustmentEngine', () => {
  it('low adherence reduces complexity', () => {
    const adjustment = buildAdherenceAdjustment(
      makeReport({ overallRate: 62, mainlineRate: 70 }),
      DEFAULT_PROGRAM_TEMPLATE
    );

    expect(adjustment.complexityLevel).toBe('reduced');
    expect(adjustment.weeklyVolumeMultiplier).toBeLessThan(1);
  });

  it('low correction adherence switches to minimal dose', () => {
    const adjustment = buildAdherenceAdjustment(
      makeReport({ correctionRate: 45 }),
      DEFAULT_PROGRAM_TEMPLATE
    );

    expect(adjustment.correctionDoseAdjustment).toBe('minimal');
  });

  it('low functional adherence removes optional addons', () => {
    const adjustment = buildAdherenceAdjustment(
      makeReport({ functionalRate: 50 }),
      DEFAULT_PROGRAM_TEMPLATE
    );

    expect(adjustment.functionalDoseAdjustment).toBe('remove_optional');
  });

  it('time skip reason shortens plan instead of volume-only reduction', () => {
    const adjustment = buildAdherenceAdjustment(
      makeReport({
        overallRate: 64,
        skippedSupportExercises: [
          {
            exerciseId: 'pallof_press',
            moduleId: 'func_core_anti_rotation_01',
            blockType: 'functional',
            count: 3,
            mostCommonReason: 'time',
          },
        ],
      }),
      DEFAULT_PROGRAM_TEMPLATE
    );

    expect(adjustment.sessionDurationHint).toBe(30);
    expect(adjustment.reasons.join(' ')).toContain('时间');
  });
});
