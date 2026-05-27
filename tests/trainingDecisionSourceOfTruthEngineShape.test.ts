// Engine-shape contract for TrainingDecision.
// See docs/TRAINING_RECOMMENDATION_SOURCE_OF_TRUTH_REWRITE_PLAN_V1.md §5.

import { describe, expect, it } from 'vitest';
import { buildTrainingDecision } from '../src/engines/trainingDecisionEngine';
import { getTemplate, makeStatus } from './fixtures';

const REFERENCE_DATE = '2026-05-27T12:00:00.000Z';

describe('trainingDecisionSourceOfTruthEngineShape', () => {
  it('produces a TrainingDecision with every owned field present', () => {
    const decision = buildTrainingDecision({
      template: getTemplate('push-a'),
      todayStatus: makeStatus({ time: '60' }),
      history: [],
      trainingMode: 'hybrid',
      nowIso: REFERENCE_DATE,
    });

    expect(decision).toMatchObject({
      activePhase: expect.any(String),
      trainingMode: expect.any(String),
      sessionIntent: expect.any(String),
      riskLevel: expect.any(String),
      progressionMode: expect.any(String),
      volumeMode: expect.any(String),
      intensityMode: expect.any(String),
      decisionVersion: 'v1',
    });
    expect(Array.isArray(decision.exercisePrescriptions)).toBe(true);
    expect(Array.isArray(decision.workingSetTargets)).toBe(true);
    expect(decision.weeklyAdjustment).toBeDefined();
    expect(decision.userFacing).toBeDefined();
    expect(decision.hiddenDebugSignals).toBeDefined();
    expect(Array.isArray(decision.hiddenDebugSignals.arbitrationTrace)).toBe(true);
  });

  it('userFacing.today has a single coherent headline within 60 chars', () => {
    const decision = buildTrainingDecision({
      template: getTemplate('push-a'),
      todayStatus: makeStatus({ time: '60' }),
      history: [],
      trainingMode: 'hybrid',
      nowIso: REFERENCE_DATE,
    });
    const today = decision.userFacing.today;
    expect(today?.headline).toBeDefined();
    expect((today?.headline || '').length).toBeLessThanOrEqual(60);
  });

  it('produces ≤ 1 risk badge per surface (AR-6)', () => {
    const decision = buildTrainingDecision({
      template: getTemplate('push-a'),
      todayStatus: makeStatus({ time: '60' }),
      history: [],
      trainingMode: 'hybrid',
      nowIso: REFERENCE_DATE,
    });
    for (const [, surface] of Object.entries(decision.userFacing)) {
      if (surface?.riskBadge) {
        // riskBadge is a single object, not an array; structural cap is enforced by type.
        expect(surface.riskBadge).toMatchObject({ level: expect.any(String), label: expect.any(String) });
      }
    }
  });
});
