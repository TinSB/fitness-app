import { describe, expect, it } from 'vitest';
import { buildRecoveryAwareRecommendation } from '../src/engines/recoveryAwareScheduler';
import type { ReadinessResult, TrainingTemplate } from '../src/models/training-model';
import { getTemplate, templates } from './fixtures';

const shoulder = '\u80a9\u90e8';
const chest = '\u80f8\u90e8';
const leg = '\u817f\u90e8';

const visibleText = (recommendation: ReturnType<typeof buildRecoveryAwareRecommendation>) =>
  [
    recommendation.templateName,
    recommendation.title,
    recommendation.summary,
    ...recommendation.affectedAreas,
    ...recommendation.reasons,
    ...recommendation.suggestedChanges.map((change) => change.reason),
  ]
    .filter(Boolean)
    .join('\n');

const oneExerciseTemplate = (template: TrainingTemplate, exerciseId: string): TrainingTemplate => ({
  ...template,
  id: 'single-upper',
  name: '上肢轻量',
  exercises: template.exercises.filter((exercise) => exercise.id === exerciseId),
});

describe('recoveryAwareScheduler', () => {
  it('does not normally recommend Upper when shoulder soreness has high overlap', () => {
    const recommendation = buildRecoveryAwareRecommendation({
      preferredTemplate: getTemplate('upper'),
      templates,
      sorenessAreas: [shoulder],
    });

    expect(recommendation.requiresConfirmationToOverride).toBe(true);
    expect(recommendation.conflictLevel).toBe('high');
    expect(recommendation.kind === 'train' ? recommendation.templateId : recommendation.kind).not.toBe('upper');
  });

  it('can recommend Legs A when shoulder soreness makes Upper high conflict', () => {
    const recommendation = buildRecoveryAwareRecommendation({
      preferredTemplate: getTemplate('upper'),
      templates: [getTemplate('upper'), getTemplate('legs-a')],
      sorenessAreas: [shoulder],
    });

    expect(recommendation.kind).toBe('train');
    expect(recommendation.templateId).toBe('legs-a');
    expect(recommendation.suggestedChanges.some((change) => change.type === 'choose_alternative_template')).toBe(true);
  });

  it('does not normally recommend Legs A when legs are sore', () => {
    const recommendation = buildRecoveryAwareRecommendation({
      preferredTemplate: getTemplate('legs-a'),
      templates: [getTemplate('legs-a'), getTemplate('push-a')],
      sorenessAreas: [leg],
    });

    expect(recommendation.kind === 'train' ? recommendation.templateId : recommendation.kind).not.toBe('legs-a');
    expect(recommendation.requiresConfirmationToOverride).toBe(true);
  });

  it('does not normally recommend Push A when chest is sore', () => {
    const recommendation = buildRecoveryAwareRecommendation({
      preferredTemplate: getTemplate('push-a'),
      templates: [getTemplate('push-a'), getTemplate('legs-a')],
      sorenessAreas: [chest],
    });

    expect(recommendation.kind === 'train' ? recommendation.templateId : recommendation.kind).not.toBe('push-a');
  });

  it('recommends rest when conflict is high and readiness is low', () => {
    const lowReadiness: ReadinessResult = {
      score: 38,
      level: 'low',
      trainingAdjustment: 'recovery',
      reasons: ['睡眠不足'],
    };
    const recommendation = buildRecoveryAwareRecommendation({
      preferredTemplate: getTemplate('upper'),
      templates,
      sorenessAreas: [shoulder],
      readinessResult: lowReadiness,
    });

    expect(recommendation.kind).toBe('rest');
    expect(recommendation.templateId).toBeUndefined();
  });

  it('returns modified_train for moderate conflict', () => {
    const moderateTemplate = oneExerciseTemplate(getTemplate('push-a'), 'bench-press');
    const recommendation = buildRecoveryAwareRecommendation({
      preferredTemplate: moderateTemplate,
      templates: [moderateTemplate],
      sorenessAreas: [shoulder],
    });

    expect(recommendation.kind).toBe('modified_train');
    expect(recommendation.suggestedChanges.some((change) => change.type === 'reduce_volume')).toBe(true);
  });

  it('uses Chinese product copy without raw enum leakage', () => {
    const recommendation = buildRecoveryAwareRecommendation({
      preferredTemplate: getTemplate('upper'),
      templates,
      sorenessAreas: [shoulder],
    });
    const text = visibleText(recommendation);

    expect(text).toMatch(/肩部|今日建议|恢复|训练/);
    expect(text).not.toMatch(/\b(undefined|null|modified_train|active_recovery|reduce_volume|choose_alternative_template|high|moderate|low)\b/i);
  });
});
