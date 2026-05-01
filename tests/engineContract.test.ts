import { describe, expect, it } from 'vitest';
import { buildCoachActions } from '../src/engines/coachActionEngine';
import { buildDataHealthReport } from '../src/engines/dataHealthEngine';
import { buildDailyTrainingAdjustment } from '../src/engines/dailyTrainingAdjustmentEngine';
import { detectSetAnomalies } from '../src/engines/setAnomalyEngine';
import { buildNextWorkoutRecommendation } from '../src/engines/nextWorkoutScheduler';
import { aggregatePlanAdvice } from '../src/presenters/planAdviceAggregator';
import { buildTemplateRecoveryConflict } from '../src/engines/recoveryAwareScheduler';
import { buildSessionDetailSummary } from '../src/engines/sessionDetailSummaryEngine';
import { buildSessionPatchesFromDailyAdjustment } from '../src/engines/sessionPatchEngine';
import { decideWarmupPolicy } from '../src/engines/warmupPolicyEngine';
import { buildTrainingDecisionContext } from '../src/engines/trainingDecisionContext';
import { getTemplate, makeAppData, makeSession } from './fixtures';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

const textKeys = new Set([
  'title',
  'summary',
  'reason',
  'message',
  'description',
  'label',
  'suggestedAction',
]);

const collectVisibleText = (value: unknown): string[] => {
  if (!value) return [];
  if (typeof value === 'string') return [];
  if (Array.isArray(value)) return value.flatMap(collectVisibleText);
  if (typeof value !== 'object') return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, item]) => {
    if (typeof item === 'string' && textKeys.has(key)) return [item];
    return collectVisibleText(item);
  });
};

const expectEngineContract = <TInput, TOutput>(
  name: string,
  input: TInput,
  run: (input: TInput) => TOutput,
) => {
  const before = clone(input);
  const first = run(input);
  const second = run(input);
  const visibleText = collectVisibleText(first).join('\n');

  expect(input, name).toEqual(before);
  expect(second, name).toEqual(first);
  expect(JSON.stringify(first), name).not.toMatch(/\bundefined|null\b/);
  if (visibleText) {
    expect(visibleText, name).toMatch(/[\u4e00-\u9fff]/);
    expect(visibleText, name).not.toMatch(
      /\b(undefined|null|hybrid|hypertrophy|strength|fat_loss|warmup|working|support|compound|isolation|machine)\b/i,
    );
  }
};

describe('engine contracts', () => {
  it('keeps key engines pure, stable and localized for normal inputs', () => {
    const data = makeAppData();
    const context = buildTrainingDecisionContext(data, '2026-04-30');
    const pushSession = makeSession({
      id: 'push-session',
      date: '2026-04-29',
      templateId: 'push-a',
      exerciseId: 'bench-press',
      setSpecs: [{ weight: 80, reps: 6, rir: 2 }],
    });
    const adjustment = buildDailyTrainingAdjustment({
      readinessResult: context.readinessResult,
      recentHistory: [],
      painPatterns: [],
      loadFeedbackSummary: [],
      trainingLevel: context.trainingLevel,
      activeTemplate: getTemplate('push-a'),
    });

    expectEngineContract('nextWorkoutScheduler', { history: [], templates: data.templates, programTemplate: data.programTemplate }, (input) =>
      buildNextWorkoutRecommendation(input),
    );
    expectEngineContract('recoveryAwareScheduler', { template: getTemplate('pull-a'), sorenessAreas: [], painAreas: [] }, (input) =>
      buildTemplateRecoveryConflict(input),
    );
    expectEngineContract('dailyTrainingAdjustmentEngine', { adjustment }, (input) => input.adjustment);
    expectEngineContract('coachActionEngine', { appData: data, dataHealthReport: buildDataHealthReport(data) }, (input) =>
      buildCoachActions(input),
    );
    expectEngineContract('planAdviceAggregator', { actions: buildCoachActions({ appData: data }), volumeAdaptation: null, drafts: [] }, (input) =>
      aggregatePlanAdvice(input.actions, input.volumeAdaptation, input.drafts),
    );
    expectEngineContract('sessionPatchEngine', { adjustment }, (input) =>
      buildSessionPatchesFromDailyAdjustment(input.adjustment),
    );
    expectEngineContract('warmupPolicyEngine', { exercise: getTemplate('pull-a').exercises[0], exerciseIndex: 0 }, (input) =>
      decideWarmupPolicy(input),
    );
    expectEngineContract(
      'setAnomalyEngine',
      {
        currentDraft: {
          actualWeightKg: 40,
          actualReps: 8,
          actualRir: 2,
          setType: 'working',
          source: 'prescription',
        },
        exerciseId: 'lat-pulldown',
        recentHistory: [],
        plannedPrescription: { plannedWeightKg: 40, plannedReps: 8 },
      },
      (input) => detectSetAnomalies(input),
    );
    expectEngineContract('sessionDetailSummaryEngine', { session: pushSession }, (input) =>
      buildSessionDetailSummary(input.session),
    );
    expectEngineContract('dataHealthEngine', { appData: data }, (input) => buildDataHealthReport(input.appData));
  });

  it('does not let test or excluded data drive primary recommendation inputs', () => {
    const normal = makeSession({
      id: 'normal-push',
      date: '2026-04-27',
      templateId: 'push-a',
      exerciseId: 'bench-press',
      setSpecs: [{ weight: 80, reps: 6 }],
    });
    const excluded = {
      ...makeSession({
        id: 'excluded-pull',
        date: '2026-04-28',
        templateId: 'pull-a',
        exerciseId: 'lat-pulldown',
        setSpecs: [{ weight: 70, reps: 8 }],
      }),
      dataFlag: 'excluded' as const,
    };
    const context = buildTrainingDecisionContext(makeAppData({ history: [normal, excluded] }), '2026-04-30');

    expect(context.normalHistory.map((session) => session.id)).toEqual(['normal-push']);
    expect(context.testExcludedHistory.map((session) => session.id)).toEqual(['excluded-pull']);
  });
});
