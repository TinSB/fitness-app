import { describe, expect, it } from 'vitest';
import { buildTemplateRecoveryConflict } from '../src/engines/recoveryAwareScheduler';
import type { ReadinessResult, TrainingTemplate } from '../src/models/training-model';
import { getTemplate } from './fixtures';

const lowReadiness: ReadinessResult = {
  score: 35,
  level: 'low',
  trainingAdjustment: 'recovery',
  reasons: ['准备度偏低'],
};

const visibleText = (result: ReturnType<typeof buildTemplateRecoveryConflict>) =>
  [
    result.templateName,
    result.summary,
    ...result.conflictingExercises.map((item) => item.reason),
    ...result.safeExercises.map((item) => item.reason),
    ...result.suggestedChanges.map((item) => item.reason),
  ].join('\n');

const expectNoRawVisibleText = (text: string) => {
  expect(text).not.toMatch(/\b(undefined|null|modified_train|active_recovery|reduce_volume|reduce_intensity|skip_accessory|high|moderate|low|none)\b/);
};

describe('template recovery conflict', () => {
  it('summarizes back soreness plus Legs A as modified training', () => {
    const result = buildTemplateRecoveryConflict({
      template: getTemplate('legs-a'),
      sorenessAreas: ['背部'],
    });

    expect(result.kind).toBe('modified_train');
    expect(result.conflictLevel).toBe('moderate');
    expect(result.summary).toContain('腿 A');
    expect(result.summary).toContain('保守版');
  });

  it('marks Romanian deadlift as the conflict inside Legs A for back soreness', () => {
    const result = buildTemplateRecoveryConflict({
      template: getTemplate('legs-a'),
      sorenessAreas: ['背部'],
    });

    expect(result.conflictingExercises.map((item) => item.exerciseId)).toContain('romanian-deadlift');
    expect(result.suggestedChanges.some((change) => change.exerciseId === 'romanian-deadlift')).toBe(true);
  });

  it('keeps lower-conflict leg movements safe for back soreness', () => {
    const result = buildTemplateRecoveryConflict({
      template: getTemplate('legs-a'),
      sorenessAreas: ['背部'],
    });
    const safeIds = result.safeExercises.map((item) => item.exerciseId);

    expect(safeIds).toContain('leg-press');
    expect(safeIds).toContain('leg-curl');
    expect(safeIds).toContain('calf-raise');
  });

  it('scores leg soreness plus Legs A as high conflict', () => {
    const result = buildTemplateRecoveryConflict({
      template: getTemplate('legs-a'),
      sorenessAreas: ['腿部'],
    });

    expect(result.conflictLevel).toBe('high');
    expect(result.conflictingExercises.length).toBeGreaterThanOrEqual(3);
  });

  it('scores shoulder soreness plus Upper as moderate or high conflict', () => {
    const result = buildTemplateRecoveryConflict({
      template: getTemplate('upper'),
      sorenessAreas: ['肩部'],
    });

    expect(['moderate', 'high']).toContain(result.conflictLevel);
    expect(result.conflictingExercises.map((item) => item.exerciseId)).toContain('shoulder-press');
  });

  it('uses rest or active recovery when readiness is low and conflict is high', () => {
    const result = buildTemplateRecoveryConflict({
      template: getTemplate('legs-a'),
      painAreas: ['腿部'],
      readinessResult: lowReadiness,
    });

    expect(['rest', 'active_recovery']).toContain(result.kind);
    expect(result.conflictLevel).toBe('high');
  });

  it('keeps accessory-only conflict as modified training instead of rest', () => {
    const push = getTemplate('push-a');
    const accessoryTemplate: TrainingTemplate = {
      ...push,
      id: 'accessory-only',
      name: '辅助动作测试',
      exercises: push.exercises.filter((exercise) => exercise.id === 'cable-fly'),
    };

    const result = buildTemplateRecoveryConflict({
      template: accessoryTemplate,
      sorenessAreas: ['胸部'],
    });

    expect(result.kind).toBe('modified_train');
    expect(result.suggestedChanges[0]?.type).toBe('skip_accessory');
  });

  it('does not mutate the template object', () => {
    const template = getTemplate('legs-a');
    const before = JSON.stringify(template);

    buildTemplateRecoveryConflict({
      template,
      sorenessAreas: ['背部'],
    });

    expect(JSON.stringify(template)).toBe(before);
  });

  it('keeps visible copy Chinese without raw enum text', () => {
    const result = buildTemplateRecoveryConflict({
      template: getTemplate('legs-a'),
      sorenessAreas: ['背部'],
    });

    const text = visibleText(result);
    expect(text).toMatch(/[一-龥]/);
    expectNoRawVisibleText(text);
  });
});
