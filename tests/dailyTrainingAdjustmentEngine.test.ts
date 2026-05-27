// dailyTrainingAdjustmentEngine — signal-only contract after Training
// Recommendation Hard Rewrite V2. Asserts only the type / reason codes /
// suggestedChanges enum contract; the legacy user-facing title/summary text
// fields are gone.

import { describe, expect, it } from 'vitest';
import { buildDailyTrainingAdjustment } from '../src/engines/dailyTrainingAdjustmentEngine';
import type { ReadinessResult } from '../src/models/training-model';

const baseReadiness: ReadinessResult = { score: 85, level: 'high', trainingAdjustment: 'normal', reasons: [] };

describe('dailyTrainingAdjustmentEngine signal-only contract', () => {
  it('returns normal type with no constraints for healthy input', () => {
    const adjustment = buildDailyTrainingAdjustment({ readinessResult: baseReadiness });
    expect(adjustment.type).toBe('normal');
    expect(adjustment.suggestedChanges).toEqual([]);
    expect(adjustment.requiresUserConfirmation).toBe(false);
  });

  it('marks low readiness recovery as rest_or_recovery with structured reason codes', () => {
    const adjustment = buildDailyTrainingAdjustment({
      readinessResult: { score: 40, level: 'low', trainingAdjustment: 'recovery', reasons: [] },
    });
    expect(adjustment.type).toBe('rest_or_recovery');
    expect(adjustment.reasons).toContain('readiness_recovery');
    expect(adjustment.suggestedChanges.map((c) => c.type)).toContain('reduce_volume');
  });

  it('does not expose any user-facing text fields on the result', () => {
    const adjustment = buildDailyTrainingAdjustment({
      readinessResult: { score: 55, level: 'medium', trainingAdjustment: 'conservative', reasons: [] },
    });
    expect(adjustment).not.toHaveProperty('title');
    expect(adjustment).not.toHaveProperty('summary');
    expect(adjustment).not.toHaveProperty('userMessage');
    expect(adjustment.suggestedChanges.every((c) => !('reason' in c) && typeof c.code === 'string')).toBe(true);
  });
});
