// Engine-shape contract for TrainingDecision V2.
// See docs/IRONPATH_iOS_SYSTEM_LOGIC.md.

import { describe, expect, it } from 'vitest';
import { buildTrainingDecision } from '../src/engines/trainingDecisionEngine';
import { getTemplate, makeStatus } from './fixtures';

const REFERENCE_DATE = '2026-05-27T12:00:00.000Z';

describe('trainingDecisionHardRewriteEngineShape', () => {
  it('decisionVersion is v2', () => {
    const decision = buildTrainingDecision({
      template: getTemplate('push-a'),
      todayStatus: makeStatus({ time: '60' }),
      history: [],
      trainingMode: 'hybrid',
      nowIso: REFERENCE_DATE,
    });
    expect(decision.decisionVersion).toBe('v2');
  });

  it('produces every owned field', () => {
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
      computedAtIso: expect.any(String),
    });
    expect(Array.isArray(decision.exercisePrescriptions)).toBe(true);
    expect(Array.isArray(decision.workingSetTargets)).toBe(true);
    expect(Array.isArray(decision.muscleGroupVolumeTargets)).toBe(true);
    expect(decision.weeklyAdjustment).toBeDefined();
    expect(decision.userFacing).toBeDefined();
    expect(decision.hiddenDebugSignals).toBeDefined();
    expect(Array.isArray(decision.hiddenDebugSignals.arbitrationTrace)).toBe(true);
  });

  it('determinism: identical input → deep-equal output', () => {
    const input = {
      template: getTemplate('push-a'),
      todayStatus: makeStatus({ time: '60' }),
      history: [],
      trainingMode: 'hybrid' as const,
      nowIso: REFERENCE_DATE,
    };
    const a = buildTrainingDecision(input);
    const b = buildTrainingDecision(input);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
