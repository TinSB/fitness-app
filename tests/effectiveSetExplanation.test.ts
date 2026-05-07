import { describe, expect, it } from 'vitest';
import {
  buildEffectiveSetExplanation,
  EFFECTIVE_SET_EXPLANATION_REASON_LABELS,
  type EffectiveSetExplanationReason,
} from '../src/engines/effectiveSetExplanationEngine';
import type { TrainingSession, TrainingSetLog } from '../src/models/training-model';
import { makeSession } from './fixtures';

const makeExplanationSession = (
  sets: TrainingSetLog[],
  overrides: Partial<TrainingSession> = {},
): TrainingSession => {
  const session = makeSession({
    id: 'effective-explanation',
    date: '2026-05-04',
    templateId: 'push-a',
    exerciseId: 'bench-press',
    setSpecs: [{ weight: 80, reps: 8, rir: 2, techniqueQuality: 'good' }],
  });
  session.exercises[0].sets = sets;
  return { ...session, ...overrides };
};

const workingSet = (id: string, overrides: Partial<TrainingSetLog> = {}): TrainingSetLog => ({
  id,
  type: 'straight',
  weight: 80,
  actualWeightKg: 80,
  reps: 8,
  rir: 2,
  done: true,
  techniqueQuality: 'good',
  ...overrides,
});

const reasonCodes = (session: TrainingSession) => buildEffectiveSetExplanation(session).excludedSets.map((item) => item.reasonCode);

describe('effective set explanation', () => {
  it('counts effective completed working sets and explains done=false sets as incomplete', () => {
    const explanation = buildEffectiveSetExplanation(
      makeExplanationSession([
        workingSet('completed'),
        workingSet('draft', { done: false, completionStatus: 'draft', weight: 200, actualWeightKg: 200, reps: 10 }),
      ]),
    );

    expect(explanation).toMatchObject({
      completedWorkingSets: 1,
      totalCompletedWorkingSets: 1,
      countedEffectiveSets: 1,
      excludedSetCount: 1,
      countedSets: [expect.objectContaining({ exerciseName: '平板卧推', setIndex: 1, reason: '符合有效组条件。' })],
      excludedSets: [expect.objectContaining({ reasonCode: 'incomplete', reason: '该组未完成，不计入有效组。' })],
    });
  });

  it('explains warmup and unsupported set types without counting them as completed working sets', () => {
    const explanation = buildEffectiveSetExplanation(
      makeExplanationSession([
        workingSet('warmup', { type: 'warmup', weight: 40, actualWeightKg: 40, reps: 8, rir: '' }),
        workingSet('support', { type: 'corrective' }),
        workingSet('completed'),
      ]),
    );

    expect(explanation.completedWorkingSets).toBe(1);
    expect(explanation.countedEffectiveSets).toBe(1);
    expect(explanation.excludedSets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ reasonCode: 'warmup', reason: '热身组不计入有效组。' }),
        expect.objectContaining({ reasonCode: 'unsupported_set_type', reason: '该组类型不参与有效组统计。' }),
      ]),
    );
  });

  it('explains missing load or reps before evaluating effort quality', () => {
    const explanation = buildEffectiveSetExplanation(
      makeExplanationSession([
        workingSet('missing-weight', { weight: 0, actualWeightKg: 0, reps: 8, done: true }),
        workingSet('missing-reps', { reps: 0, done: true }),
      ]),
    );

    expect(explanation.completedWorkingSets).toBe(0);
    expect(explanation.excludedSets.map((item) => item.reasonCode)).toEqual(['missing_weight_or_reps', 'missing_weight_or_reps']);
    expect(explanation.excludedSets[0].reason).toBe('该组缺少重量或次数，无法判断训练刺激。');
  });

  it.each<Array<[Partial<TrainingSetLog>, EffectiveSetExplanationReason, string]>>([
    [{ identityInvalid: true }, 'identity_invalid', '动作身份需要检查，暂不进入有效组统计。'],
    [{ painFlag: true }, 'pain_flag', '该组标记了不适，系统不会作为高质量刺激。'],
    [{ techniqueQuality: 'poor' }, 'poor_technique', '动作质量较低，未作为高质量有效组。'],
    [{ rir: '', reps: 3 }, 'rir_missing', '该组 RIR 记录不完整，置信度较低。'],
    [{ rir: 6 }, 'not_enough_effort', '该组距离力竭较远，未达到有效组标准。'],
  ])('maps ineffective set conditions to stable explanation reasons', (setOverrides, reasonCode, reason) => {
    const explanation = buildEffectiveSetExplanation(makeExplanationSession([workingSet(`set-${reasonCode}`, setOverrides)]));

    expect(reasonCodes(makeExplanationSession([workingSet(`set-${reasonCode}`, setOverrides)]))).toContain(reasonCode);
    expect(explanation.excludedSets).toContainEqual(expect.objectContaining({ reasonCode, reason }));
    expect(EFFECTIVE_SET_EXPLANATION_REASON_LABELS[reasonCode]).toBe(reason);
  });

  it('explains test and excluded sessions as outside default statistics', () => {
    const testExplanation = buildEffectiveSetExplanation(makeExplanationSession([workingSet('test-set')], { dataFlag: 'test' }));
    const excludedExplanation = buildEffectiveSetExplanation(makeExplanationSession([workingSet('excluded-set')], { dataFlag: 'excluded' }));

    expect(testExplanation).toMatchObject({
      completedWorkingSets: 1,
      countedEffectiveSets: 0,
      excludedSets: [expect.objectContaining({ reasonCode: 'test_or_excluded', reason: '该训练被标记为测试或排除，不参与默认统计。' })],
    });
    expect(excludedExplanation.countedEffectiveSets).toBe(0);
    expect(excludedExplanation.excludedSets.map((item) => item.reasonCode)).toContain('test_or_excluded');
  });

  it('keeps user-visible explanation text free of raw enums and empty values', () => {
    const explanation = buildEffectiveSetExplanation(
      makeExplanationSession([
        workingSet('draft', { done: false }),
        workingSet('pain', { painFlag: true }),
      ]),
    );
    const visibleText = [
      explanation.summary,
      ...explanation.countedSets.map((item) => `${item.exerciseName} 第 ${item.setIndex} 组：${item.reason}`),
      ...explanation.excludedSets.map((item) => `${item.exerciseName} 第 ${item.setIndex} 组：${item.reason}`),
    ].join(' ');

    expect(visibleText).not.toMatch(/\b(undefined|null|warmup|incomplete|pain_flag|poor_technique|identity_invalid|test_or_excluded|not_enough_effort|unsupported_set_type|missing_weight_or_reps)\b/);
    expect(visibleText).not.toMatch(/bench-press|__auto_alt|__alt_/);
  });
});
