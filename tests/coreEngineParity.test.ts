import { describe, expect, it } from 'vitest';
import * as core from '../packages/core/src';
import { buildNextWorkoutRecommendation as srcBuildNextWorkoutRecommendation } from '../src/engines/nextWorkoutScheduler';
import { buildReplacementOptions as srcBuildReplacementOptions } from '../src/engines/replacementEngine';
import { buildSessionDetailSummary as srcBuildSessionDetailSummary } from '../src/engines/sessionDetailSummaryEngine';
import { buildSmartReplacementRecommendations as srcBuildSmartReplacementRecommendations } from '../src/engines/smartReplacementEngine';
import { convertKgToDisplayWeight as srcConvertKgToDisplayWeight, formatWeight as srcFormatWeight } from '../src/engines/unitConversionEngine';
import { buildEffectiveSetExplanation as srcBuildEffectiveSetExplanation } from '../src/engines/effectiveSetExplanationEngine';
import { buildWorkoutCycleState as srcBuildWorkoutCycleState } from '../src/engines/workoutCycleScheduler';
import type { ExerciseEquipmentTag } from '../src/data/exerciseLibrary';
import { buildAppDataFromFixture } from './helpers/realDataFixture';
import { makeSession } from './fixtures';

const visibleTextKeys = new Set(['exerciseName', 'message', 'reason', 'summary', 'templateName', 'warning']);

const collectVisibleText = (value: unknown): string[] => {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(collectVisibleText);
  return Object.entries(value as Record<string, unknown>).flatMap(([key, item]) => {
    if (typeof item === 'string' && visibleTextKeys.has(key)) return [item];
    return collectVisibleText(item);
  });
};

const expectNoLeakyVisibleText = (value: unknown) => {
  const text = collectVisibleText(value).join('\n');
  expect(text).not.toMatch(/\bundefined|null\b/i);
  expect(text).not.toMatch(/__(?:auto_)?alt|__alt_/i);
};

describe('packages/core engine parity', () => {
  it('matches session detail summary and effective-set explanation from src engines', () => {
    const data = buildAppDataFromFixture('incomplete-draft-sets-session');
    const session = data.history[0];

    const coreSummary = core.buildSessionDetailSummary(session);
    const srcSummary = srcBuildSessionDetailSummary(session);
    const coreExplanation = core.buildEffectiveSetExplanation(session);
    const srcExplanation = srcBuildEffectiveSetExplanation(session);

    expect(coreSummary).toEqual(srcSummary);
    expect(coreExplanation).toEqual(srcExplanation);
    expectNoLeakyVisibleText(coreSummary);
    expectNoLeakyVisibleText(coreExplanation);
  });

  it('matches PPL cycle and next-workout scheduler output from src engines', () => {
    const data = buildAppDataFromFixture('ppl-cycle-boundary-history');
    const todayState = {
      status: 'not_started' as const,
      date: '2026-05-04',
      primaryAction: 'start_training' as const,
    };
    const orderedTemplateIds = ['push-a', 'pull-a', 'legs-a'];

    const coreCycle = core.buildWorkoutCycleState({
      history: data.history,
      orderedTemplateIds,
      currentDate: '2026-05-04',
    });
    const srcCycle = srcBuildWorkoutCycleState({
      history: data.history,
      orderedTemplateIds,
      currentDate: '2026-05-04',
    });
    const coreNext = core.buildNextWorkoutRecommendation({
      history: data.history,
      templates: data.templates,
      programTemplate: data.programTemplate,
      todayState,
    });
    const srcNext = srcBuildNextWorkoutRecommendation({
      history: data.history,
      templates: data.templates,
      programTemplate: data.programTemplate,
      todayState,
    });

    expect(coreCycle).toEqual(srcCycle);
    expect(coreNext).toEqual(srcNext);
    expectNoLeakyVisibleText(coreCycle);
    expectNoLeakyVisibleText(coreNext);
  });

  it('matches replacement engine and smart replacement output from src engines', () => {
    const currentExercise = makeSession({
      id: 'parity-push',
      date: '2026-05-04',
      templateId: 'push-a',
      exerciseId: 'incline-db-press',
      setSpecs: [{ weight: 32, reps: 8, rir: 2 }],
    }).exercises[0];
    if (!currentExercise) throw new Error('Missing incline-db-press fixture exercise');
    const exerciseLibrary = buildAppDataFromFixture('legacy-assisted-pullup-session').templates.flatMap(
      (item) => item.exercises,
    );

    const unavailableEquipment: ExerciseEquipmentTag[] = ['dumbbell'];
    const replacementContext = { unavailableEquipment };
    const smartInput = {
      currentExercise,
      exerciseLibrary,
      unavailableEquipment,
    };

    const coreOptions = core.buildReplacementOptions(currentExercise, replacementContext);
    const srcOptions = srcBuildReplacementOptions(currentExercise, replacementContext);
    const coreSmart = core.buildSmartReplacementRecommendations(smartInput);
    const srcSmart = srcBuildSmartReplacementRecommendations(smartInput);

    expect(coreOptions).toEqual(srcOptions);
    expect(coreSmart).toEqual(srcSmart);
    expectNoLeakyVisibleText(coreOptions);
    expectNoLeakyVisibleText(coreSmart);
  });

  it('matches unit conversion output from src engines', () => {
    expect(core.convertKgToDisplayWeight(52.617, 'lb')).toBe(srcConvertKgToDisplayWeight(52.617, 'lb'));
    expect(core.convertKgToDisplayWeight(52.617, 'kg')).toBe(srcConvertKgToDisplayWeight(52.617, 'kg'));
    expect(core.formatWeight(52.617, { weightUnit: 'lb' })).toBe(srcFormatWeight(52.617, { weightUnit: 'lb' }));
    expect(core.formatWeight(52.617, { weightUnit: 'kg' })).toBe(srcFormatWeight(52.617, { weightUnit: 'kg' }));
  });
});
