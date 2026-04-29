import { describe, expect, it } from 'vitest';
import { DEFAULT_PROGRAM_TEMPLATE, DEFAULT_SCREENING_PROFILE, DEFAULT_STATUS } from '../src/data/trainingData';
import { clone } from '../src/engines/engineUtils';
import {
  applyAdjustmentDraft,
  buildAdjustmentDiff,
  createAdjustmentDraftFromRecommendations,
  hashProgramTemplate,
  rollbackAdjustment,
} from '../src/engines/programAdjustmentEngine';
import { reviewAdjustmentEffect } from '../src/engines/adjustmentReviewEngine';
import { createSession } from '../src/engines/sessionBuilder';
import { buildWeeklyActionRecommendations } from '../src/engines/weeklyCoachActionEngine';
import type {
  MuscleVolumeDashboardRow,
  ProgramAdjustmentDraft,
  ProgramTemplate,
  TrainingTemplate,
  WeeklyActionRecommendation,
} from '../src/models/training-model';
import { getTemplate, makeSession, templates } from './fixtures';

const appliedAt = '2026-04-20T00:00:00.000Z';

const backGapRow = (): MuscleVolumeDashboardRow => ({
  muscleId: '背',
  muscleName: '背部',
  targetSets: 12,
  completedSets: 4,
  effectiveSets: 4,
  highConfidenceEffectiveSets: 4,
  weightedEffectiveSets: 4,
  remainingSets: 8,
  status: 'low',
  notes: [],
});

const selectedBackRecommendation = (base: WeeklyActionRecommendation): WeeklyActionRecommendation => ({
  ...base,
  id: 'rec-back-pull-up',
  priority: 'high',
  category: 'volume',
  targetType: 'muscle',
  targetId: '背',
  targetLabel: '背部',
  issue: '背部本周有效组不足',
  recommendation: '下周新增引体向上 2 组补足背部训练量',
  reason: '背部加权有效组低于目标，新增垂直拉动作比继续堆已有动作更清晰。',
  suggestedChange: {
    muscleId: '背',
    setsDelta: 2,
    exerciseIds: ['pull-up'],
  },
  confidence: 'high',
});

const makeDraft = (
  sourceTemplate: TrainingTemplate,
  programTemplate: ProgramTemplate,
  change: ProgramAdjustmentDraft['changes'][number],
): ProgramAdjustmentDraft => ({
  id: 'integration-draft-1',
  createdAt: '2026-04-26T00:00:00.000Z',
  status: 'previewed',
  sourceProgramTemplateId: sourceTemplate.id,
  sourceTemplateSnapshotHash: hashProgramTemplate(sourceTemplate),
  sourceTemplateUpdatedAt: sourceTemplate.updatedAt || '2026-04-26T00:00:00.000Z',
  title: `${sourceTemplate.name} adjustment`,
  summary: 'Integration adjustment preview',
  selectedRecommendationIds: ['rec-integration'],
  changes: [change],
  confidence: 'high',
  notes: [],
});

describe('program adjustment workflow integration', () => {
  it('runs the full draft, apply, session, review, and rollback workflow without mutating the source template', () => {
    const sourceTemplate = clone(getTemplate('pull-a'));
    const sourceSnapshot = JSON.stringify(sourceTemplate);
    const programTemplate = clone(DEFAULT_PROGRAM_TEMPLATE);
    const weeklyActions = buildWeeklyActionRecommendations({
      muscleVolumeDashboard: [backGapRow()],
      programTemplate,
      screeningProfile: DEFAULT_SCREENING_PROFILE,
      painPatterns: [],
    });
    const actionable = weeklyActions.find((item) => item.suggestedChange);
    expect(actionable).toBeTruthy();

    const selectedRecommendation = selectedBackRecommendation(actionable as WeeklyActionRecommendation);
    const draft = createAdjustmentDraftFromRecommendations([selectedRecommendation], sourceTemplate, {
      programTemplate,
      templates,
      screeningProfile: DEFAULT_SCREENING_PROFILE,
      painPatterns: [],
    });
    expect(draft.changes[0]?.type).toBe('add_new_exercise');

    const diff = buildAdjustmentDiff(draft, sourceTemplate, programTemplate, templates);
    const visibleDiffText = diff.changes.map((change) => `${change.label} ${change.before} ${change.after} ${change.reason}`).join(' ');
    expect(visibleDiffText).toContain('引体向上');
    expect(visibleDiffText).not.toContain('pull-up');

    const applied = applyAdjustmentDraft(draft, sourceTemplate, programTemplate, templates);
    expect(applied.ok).toBe(true);
    expect(JSON.stringify(sourceTemplate)).toBe(sourceSnapshot);
    expect(applied.experimentalTemplate).toBeTruthy();
    expect(applied.experimentalTemplate?.id).not.toBe(sourceTemplate.id);
    expect(applied.historyItem).toBeTruthy();
    expect(applied.historyItem?.experimentalProgramTemplateId).toBe(applied.experimentalTemplate?.id);

    const activeProgramTemplateId = applied.experimentalTemplate?.id;
    expect(activeProgramTemplateId).toBe(applied.historyItem?.experimentalProgramTemplateId);

    const session = createSession(applied.experimentalTemplate as TrainingTemplate, DEFAULT_STATUS, [], 'hybrid');
    expect(session.programTemplateId).toBe(applied.experimentalTemplate?.id);
    expect(session.programTemplateName).toBe(applied.experimentalTemplate?.name);
    expect(session.isExperimentalTemplate).toBe(true);

    const reviewHistoryItem = {
      ...(applied.historyItem as NonNullable<typeof applied.historyItem>),
      appliedAt,
    };
    const review = reviewAdjustmentEffect(
      reviewHistoryItem,
      [
        makeSession({
          id: 'before-1',
          date: '2026-04-10',
          templateId: 'pull-a',
          programTemplateId: sourceTemplate.id,
          exerciseId: 'seated-row',
          setSpecs: [{ weight: 55, reps: 8, rir: 2 }],
        }),
        makeSession({
          id: 'before-2',
          date: '2026-04-12',
          templateId: 'pull-a',
          programTemplateId: sourceTemplate.id,
          exerciseId: 'seated-row',
          setSpecs: [{ weight: 55, reps: 8, rir: 2 }],
        }),
        makeSession({
          id: 'after-1',
          date: '2026-04-22',
          templateId: 'pull-a',
          programTemplateId: applied.experimentalTemplate?.id,
          programTemplateName: applied.experimentalTemplate?.name,
          isExperimentalTemplate: true,
          exerciseId: 'seated-row',
          setSpecs: [
            { weight: 57.5, reps: 10, rir: 2, techniqueQuality: 'good' },
            { weight: 55, reps: 10, rir: 2, techniqueQuality: 'good' },
            { weight: 52.5, reps: 10, rir: 2, techniqueQuality: 'good' },
          ],
        }),
        makeSession({
          id: 'after-2',
          date: '2026-04-24',
          templateId: 'pull-a',
          programTemplateId: applied.experimentalTemplate?.id,
          programTemplateName: applied.experimentalTemplate?.name,
          isExperimentalTemplate: true,
          exerciseId: 'seated-row',
          setSpecs: [
            { weight: 57.5, reps: 10, rir: 2, techniqueQuality: 'good' },
            { weight: 55, reps: 10, rir: 2, techniqueQuality: 'good' },
            { weight: 52.5, reps: 10, rir: 2, techniqueQuality: 'good' },
          ],
        }),
      ],
      { targetMuscleIds: ['背'] },
    );

    expect(review.metrics.beforeSessionCount).toBe(2);
    expect(review.metrics.afterSessionCount).toBe(2);
    expect(review.status).toBe('improved');
    expect(review.recommendation).toBe('keep');

    const rollback = rollbackAdjustment(reviewHistoryItem);
    expect(rollback.restoredTemplateId).toBe(sourceTemplate.id);
    expect(rollback.updatedHistoryItem.rolledBackAt).toBeTruthy();
    expect(rollback.updatedHistoryItem.rollbackAvailable).toBe(false);
    expect(rollback.updatedHistoryItem.experimentalProgramTemplateId).toBe(applied.experimentalTemplate?.id);
  });

  it('blocks stale drafts when the source template changed after preview generation', () => {
    const sourceTemplate = clone(getTemplate('pull-a'));
    const originalSnapshot = JSON.stringify(sourceTemplate);
    const programTemplate = clone(DEFAULT_PROGRAM_TEMPLATE);
    const recommendation = selectedBackRecommendation(
      buildWeeklyActionRecommendations({
        muscleVolumeDashboard: [backGapRow()],
        programTemplate,
        screeningProfile: DEFAULT_SCREENING_PROFILE,
        painPatterns: [],
      })[0],
    );
    const draft = createAdjustmentDraftFromRecommendations([recommendation], sourceTemplate, {
      programTemplate,
      templates,
      screeningProfile: DEFAULT_SCREENING_PROFILE,
      painPatterns: [],
    });
    const changedSource = {
      ...clone(sourceTemplate),
      duration: sourceTemplate.duration + 5,
      updatedAt: '2026-04-26T12:00:00.000Z',
    };

    const result = applyAdjustmentDraft(draft, changedSource, clone(DEFAULT_PROGRAM_TEMPLATE), templates);
    expect(result.ok).toBe(false);
    expect(result.draft.status).toBe('expired');
    expect(result.message).toBeTruthy();
    expect(result.experimentalTemplate).toBeUndefined();
    expect(result.historyItem).toBeUndefined();
    expect(JSON.stringify(sourceTemplate)).toBe(originalSnapshot);
  });

  it('applies reduce_support and increase_support to real support configuration, and marks unsafe no-op support changes as skipped', () => {
    const pushTemplate = clone(getTemplate('push-a'));
    const reduceProgram = clone(DEFAULT_PROGRAM_TEMPLATE);
    const reduceBeforeDay = reduceProgram.dayTemplates.find((day) => day.id === 'push-a');
    const reduceDraft = makeDraft(pushTemplate, reduceProgram, {
      id: 'change-reduce-support',
      type: 'reduce_support',
      dayTemplateId: pushTemplate.id,
      dayTemplateName: pushTemplate.name,
      muscleId: '胸',
      reason: '训练完成度下降，减少纠偏和功能补丁负担。',
    });

    const reduced = applyAdjustmentDraft(reduceDraft, pushTemplate, reduceProgram, templates);
    const reducedDay = reduced.updatedProgramTemplate?.dayTemplates.find((day) => day.id === reduced.experimentalTemplate?.id);
    expect(reduced.ok).toBe(true);
    expect(reduced.updatedProgramTemplate?.correctionStrategy).toBe('light');
    expect(reduced.updatedProgramTemplate?.functionalStrategy).toBe('minimal');
    expect(reducedDay?.estimatedDurationMin).toBeLessThan(reduceBeforeDay?.estimatedDurationMin || Number.POSITIVE_INFINITY);
    expect(reduced.historyItem?.changes[0]?.skipped).not.toBe(true);

    const quickTemplate = clone(getTemplate('quick-30'));
    const increased = applyAdjustmentDraft(
      makeDraft(quickTemplate, clone(DEFAULT_PROGRAM_TEMPLATE), {
        id: 'change-increase-support',
        type: 'increase_support',
        dayTemplateId: quickTemplate.id,
        dayTemplateName: quickTemplate.name,
        muscleId: '背',
        reason: '需要增加关键纠偏和功能补丁。',
      }),
      quickTemplate,
      clone(DEFAULT_PROGRAM_TEMPLATE),
      templates,
    );
    const increasedDay = increased.updatedProgramTemplate?.dayTemplates.find((day) => day.id === increased.experimentalTemplate?.id);
    expect(increased.ok).toBe(true);
    expect(increased.updatedProgramTemplate?.correctionStrategy).toBe('aggressive');
    expect(increased.updatedProgramTemplate?.functionalStrategy).toBe('enhanced');
    expect(new Set(increasedDay?.correctionBlockIds || []).size).toBe((increasedDay?.correctionBlockIds || []).length);
    expect(new Set(increasedDay?.functionalBlockIds || []).size).toBe((increasedDay?.functionalBlockIds || []).length);

    const minimalProgram: ProgramTemplate = {
      ...clone(DEFAULT_PROGRAM_TEMPLATE),
      correctionStrategy: 'light',
      functionalStrategy: 'minimal',
      dayTemplates: [
        {
          id: quickTemplate.id,
          name: quickTemplate.name,
          focusMuscles: [],
          correctionBlockIds: [],
          functionalBlockIds: [],
          mainExerciseIds: quickTemplate.exercises.map((exercise) => exercise.id),
          estimatedDurationMin: 30,
        },
      ],
    };
    const minimalQuickTemplate = { ...quickTemplate, duration: 30 };
    const skipped = applyAdjustmentDraft(
      makeDraft(minimalQuickTemplate, minimalProgram, {
        id: 'change-noop-support',
        type: 'reduce_support',
        dayTemplateId: minimalQuickTemplate.id,
        dayTemplateName: minimalQuickTemplate.name,
        reason: '已经处于最低有效支持剂量。',
      }),
      minimalQuickTemplate,
      minimalProgram,
      templates,
    );
    expect(skipped.ok).toBe(true);
    expect(skipped.historyItem?.changes[0]?.skipped).toBe(true);
    expect(skipped.historyItem?.changes[0]?.skipReason).toBeTruthy();
    expect(skipped.experimentalTemplate?.note).toContain(skipped.historyItem?.changes[0]?.skipReason || '');
  });

  it('inserts add_new_exercise without disrupting main exercise order, and skips restricted exercises', () => {
    const sourceTemplate = clone(getTemplate('pull-a'));
    const recommendation = selectedBackRecommendation({
      id: 'rec-back-pull-up',
      priority: 'high',
      category: 'volume',
      targetType: 'muscle',
      targetId: '背',
      targetLabel: '背部',
      issue: '背部本周有效组不足',
      recommendation: '新增引体向上',
      reason: '补充背部垂直拉训练量',
      suggestedChange: { muscleId: '背', setsDelta: 2, exerciseIds: ['pull-up'] },
      confidence: 'high',
    });
    const draft = createAdjustmentDraftFromRecommendations([recommendation], sourceTemplate, {
      programTemplate: DEFAULT_PROGRAM_TEMPLATE,
      templates,
      screeningProfile: DEFAULT_SCREENING_PROFILE,
      painPatterns: [],
    });
    expect(draft.changes[0]?.type).toBe('add_new_exercise');

    const applied = applyAdjustmentDraft(draft, sourceTemplate, clone(DEFAULT_PROGRAM_TEMPLATE), templates);
    const experimental = applied.experimentalTemplate as TrainingTemplate;
    expect(experimental.exercises.some((exercise) => exercise.id === 'pull-up')).toBe(true);
    expect(experimental.exercises.slice(0, sourceTemplate.exercises.length).map((exercise) => exercise.id)).toEqual(
      sourceTemplate.exercises.map((exercise) => exercise.id),
    );

    const diff = buildAdjustmentDiff(draft, sourceTemplate, DEFAULT_PROGRAM_TEMPLATE, templates);
    const visibleDiffText = diff.changes.map((change) => `${change.label} ${change.before} ${change.after}`).join(' ');
    expect(visibleDiffText).toContain('引体向上');
    expect(visibleDiffText).not.toContain('pull-up');

    const restrictedDraft = createAdjustmentDraftFromRecommendations([recommendation], sourceTemplate, {
      programTemplate: DEFAULT_PROGRAM_TEMPLATE,
      templates,
      screeningProfile: {
        ...DEFAULT_SCREENING_PROFILE,
        restrictedExercises: ['pull-up'],
      },
      painPatterns: [],
    });
    expect(restrictedDraft.changes[0]?.type).toBe('add_new_exercise');
    expect(restrictedDraft.changes[0]?.dayTemplateId).toBeUndefined();

    const restrictedApply = applyAdjustmentDraft(restrictedDraft, sourceTemplate, clone(DEFAULT_PROGRAM_TEMPLATE), templates);
    expect(restrictedApply.historyItem?.changes[0]?.skipped).toBe(true);
    expect(restrictedApply.experimentalTemplate?.exercises.some((exercise) => exercise.id === 'pull-up')).toBe(false);
  });
});
