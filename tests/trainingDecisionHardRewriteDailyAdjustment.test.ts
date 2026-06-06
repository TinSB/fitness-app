// Signal-only contract for dailyTrainingAdjustmentEngine. No title/summary
// text on the result; reasons are structured codes; suggestedChanges carry
// only type + code, never user-facing reason text.
// See docs/IRONPATH_iOS_SYSTEM_LOGIC.md.

import { describe, expect, it } from 'vitest';
import { buildDailyTrainingAdjustment } from '../src/engines/dailyTrainingAdjustmentEngine';
import type { ReadinessResult } from '../src/models/training-model';

const normal: ReadinessResult = { score: 85, level: 'high', trainingAdjustment: 'normal', reasons: [] };
const conservative: ReadinessResult = { score: 55, level: 'medium', trainingAdjustment: 'conservative', reasons: [] };

describe('trainingDecisionHardRewriteDailyAdjustment', () => {
  it('does not expose user-facing title / summary fields on the adjustment', () => {
    const adjustment = buildDailyTrainingAdjustment({ readinessResult: normal });
    expect(adjustment).not.toHaveProperty('title');
    expect(adjustment).not.toHaveProperty('summary');
  });

  it('reasons[] are structured codes, not user-facing text', () => {
    const adjustment = buildDailyTrainingAdjustment({ readinessResult: conservative });
    expect(adjustment.reasons.every((r) => /^[a-z0-9_]+$/.test(r))).toBe(true);
  });

  it('suggestedChanges carry type + code, no reason text', () => {
    const adjustment = buildDailyTrainingAdjustment({ readinessResult: conservative });
    for (const change of adjustment.suggestedChanges) {
      expect(typeof change.type).toBe('string');
      expect(typeof change.code).toBe('string');
      expect(change).not.toHaveProperty('reason');
    }
  });

  it('preserves type + multipliers contract', () => {
    const adjustment = buildDailyTrainingAdjustment({ readinessResult: normal });
    expect(['normal', 'conservative', 'deload_like', 'main_only', 'reduce_support', 'substitute_risky_exercises', 'rest_or_recovery']).toContain(
      adjustment.type,
    );
    expect(['low', 'medium', 'high']).toContain(adjustment.confidence);
  });
});
