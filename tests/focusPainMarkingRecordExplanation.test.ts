import { describe, expect, it } from 'vitest';
import {
  buildEffectiveSetExplanation,
  EFFECTIVE_SET_EXPLANATION_REASON_LABELS,
} from '../src/engines/effectiveSetExplanationEngine';
import type { TrainingSetLog } from '../src/models/training-model';
import { makeSession } from './fixtures';

const workingSet = (overrides: Partial<TrainingSetLog> = {}): TrainingSetLog => ({
  id: 'pain-set',
  type: 'straight',
  weight: 80,
  actualWeightKg: 80,
  reps: 8,
  rir: 2,
  done: true,
  techniqueQuality: 'good',
  painFlag: true,
  ...overrides,
});

describe('Focus pain marking Record explanation boundary', () => {
  it('uses the stable group-level pain explanation without long-term or medical wording', () => {
    const session = makeSession({
      id: 'pain-explanation',
      date: '2026-05-07',
      templateId: 'push-a',
      exerciseId: 'bench-press',
      setSpecs: [{ weight: 80, reps: 8, rir: 2 }],
    });
    session.exercises[0].sets = [workingSet()];

    const explanation = buildEffectiveSetExplanation(session);
    const painReason = explanation.excludedSets.find((set) => set.reasonCode === 'pain_flag');
    const visibleText = [
      explanation.summary,
      painReason?.exerciseName,
      painReason?.reason,
      EFFECTIVE_SET_EXPLANATION_REASON_LABELS.pain_flag,
    ].join(' ');

    expect(painReason).toMatchObject({
      reasonCode: 'pain_flag',
      reason: '该组标记了不适，系统不会作为高质量刺激。',
    });
    expect(EFFECTIVE_SET_EXPLANATION_REASON_LABELS.pain_flag).toBe('该组标记了不适，系统不会作为高质量刺激。');
    expect(visibleText).toContain('该组标记了不适，系统不会作为高质量刺激。');
    expect(visibleText).not.toMatch(/酸痛状态|筛查限制|长期限制|受伤|禁忌|限制问题|长期风险|undefined|null|bench-press|pain_flag/);
  });
});
