import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildE1RMProfile } from '../src/engines/e1rmEngine';
import { buildEffectiveVolumeSummary } from '../src/engines/effectiveSetEngine';
import { number, sessionVolume } from '../src/engines/engineUtils';
import { getCurrentFocusStep } from '../src/engines/focusModeStateEngine';
import { buildDataHealthViewModel } from '../src/presenters/dataHealthPresenter';
import { buildTodayViewModel } from '../src/presenters/todayPresenter';
import { updateSessionSet, markSessionEdited } from '../src/engines/sessionEditEngine';
import { buildSessionDetailSummary } from '../src/engines/sessionDetailSummaryEngine';
import { completeTrainingSessionIntoHistory } from '../src/engines/trainingCompletionEngine';
import { dispatchWorkoutExecutionEvent } from '../src/engines/workoutExecutionStateMachine';
import { TrainingFocusView } from '../src/features/TrainingFocusView';
import type { DataHealthIssue } from '../src/engines/dataHealthEngine';
import type { TodayTrainingState } from '../src/engines/todayStateEngine';
import type { TrainingSession, UnitSettings } from '../src/models/training-model';
import { emptyData } from '../src/storage/persistence';
import { getTemplate, makeSession } from './fixtures';
import { makeExercise, makeFocusSession } from './focusModeFixtures';

const unitSettings: UnitSettings = {
  weightUnit: 'kg',
  defaultIncrementKg: 2.5,
  defaultIncrementLb: 5,
  customIncrementsKg: [],
  customIncrementsLb: [],
};

const noop = (..._args: unknown[]) => undefined;
const setStateNoop = (() => undefined) as React.Dispatch<React.SetStateAction<number>>;

const visibleText = (node: React.ReactElement) =>
  renderToStaticMarkup(node)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const renderFocusText = (session: TrainingSession) =>
  visibleText(
    React.createElement(TrainingFocusView, {
      session,
      unitSettings,
      restTimer: null,
      expandedExercise: 0,
      setExpandedExercise: setStateNoop,
      onSetChange: noop,
      onCompleteSet: noop,
      onCopyPrevious: noop,
      onAdjustSet: noop,
      onApplySuggestion: noop,
      onUpdateActualDraft: noop,
      onSwitchExercise: noop,
      onReplaceExercise: noop,
      onLoadFeedback: noop,
      onFinish: noop,
      onCompleteSupportSet: noop,
      onSkipSupportExercise: noop,
      onSkipSupportBlock: noop,
      onUpdateSupportSkipReason: noop,
    }),
  );

const completedTodayState: TodayTrainingState = {
  status: 'completed',
  date: '2026-04-29',
  completedSessionIds: ['completed-session'],
  lastCompletedSessionId: 'completed-session',
  primaryAction: 'view_summary',
};

const notStartedTodayState: TodayTrainingState = {
  status: 'not_started',
  date: '2026-04-29',
  plannedTemplateId: 'push-a',
  primaryAction: 'start_training',
};

const dataHealthIssue = (id: string, severity: DataHealthIssue['severity']): DataHealthIssue => ({
  id,
  severity,
  category: severity === 'error' ? 'summary' : 'unknown',
  title: 'summary cache mismatch',
  message: 'summary cache mismatch with internal details',
  canAutoFix: false,
});

describe('product stability regression', () => {
  it('keeps Today start and completed states focused on the correct action', () => {
    const notStarted = buildTodayViewModel({
      todayState: notStartedTodayState,
      selectedTemplate: getTemplate('push-a'),
      nextSuggestion: getTemplate('pull-a'),
    });
    expect(notStarted.recommendationLabel).toBe('今日建议');
    expect(notStarted.primaryActionLabel).toBe('开始训练');

    const completed = buildTodayViewModel({
      todayState: completedTodayState,
      selectedTemplate: getTemplate('legs-a'),
      completedTemplateName: '腿 A',
      nextSuggestion: getTemplate('pull-a'),
    });
    const completedText = [completed.currentTrainingName, completed.decisionText, completed.nextSuggestion.description, completed.primaryActionLabel].join(' ');

    expect(completed.primaryActionLabel).toBe('查看本次训练');
    expect(completed.currentTrainingName).toBe('拉 A');
    expect(completed.nextSuggestion.description).toContain('拉 A');
    expect(completedText).not.toContain('开始训练');
    expect(completed.nextSuggestion.description).not.toContain('腿 A。');
  });

  it('keeps Focus Mode controls visible and productized', () => {
    const text = renderFocusText(makeFocusSession([makeExercise('bench-press', 2)]));

    expect(text).toContain('专注训练');
    expect(text).toContain('复制上组');
    expect(text).toContain('标记不适');
    expect(text).toContain('替代动作');
    expect(text).toContain('完成一组');
    expect(text).not.toContain('Focus Mode');
    expect(text).not.toMatch(/\b(undefined|null|warmup|working|support)\b/);
  });

  it('keeps replacement identity stable through a completed set and saved history', () => {
    let session = makeFocusSession([makeExercise('bench-press', 2)]);
    session = dispatchWorkoutExecutionEvent(session, {
      type: 'APPLY_REPLACEMENT',
      exerciseIndex: 0,
      replacementId: 'db-bench-press',
    }).updatedSession;
    session = dispatchWorkoutExecutionEvent(session, { type: 'APPLY_PRESCRIPTION', exerciseIndex: 0 }).updatedSession;
    session = dispatchWorkoutExecutionEvent(session, {
      type: 'COMPLETE_STEP',
      exerciseIndex: 0,
      expectedStepId: getCurrentFocusStep(session).id,
      completedAt: '2026-04-29T10:00:00.000Z',
      nowMs: Date.parse('2026-04-29T10:00:00.000Z'),
    }).updatedSession;

    expect(session.exercises[0].actualExerciseId).toBe('db-bench-press');
    expect(session.exercises[0].sets[0].done).toBe(true);
    expect(getCurrentFocusStep(session).exerciseId).toBe('db-bench-press');

    const saved = completeTrainingSessionIntoHistory({ ...emptyData(), activeSession: session }, '2026-04-29T10:15:00.000Z');
    expect(saved.session?.exercises[0].originalExerciseId).toBe('bench-press');
    expect(saved.session?.exercises[0].actualExerciseId).toBe('db-bench-press');
    expect(buildE1RMProfile(saved.data.history, 'bench-press').best).toBeUndefined();
    expect(buildE1RMProfile(saved.data.history, 'db-bench-press').best).toBeTruthy();
  });

  it('keeps history summary, working edits, and warmup edits on consistent data sources', () => {
    const session = makeSession({
      id: 'stability-history',
      date: '2026-04-29',
      templateId: 'push-a',
      exerciseId: 'bench-press',
      setSpecs: [
        { weight: 80, reps: 6, rir: 2, techniqueQuality: 'good' },
        { weight: 80, reps: 6, rir: 2, techniqueQuality: 'good' },
        { weight: 80, reps: 6, rir: 2, techniqueQuality: 'good' },
      ],
    });
    const withWarmup: TrainingSession = {
      ...session,
      focusWarmupSetLogs: [
        {
          id: 'main:bench-press:warmup:0',
          type: 'warmup',
          weight: 20,
          actualWeightKg: 20,
          reps: 8,
          rir: '',
          rpe: '',
          done: true,
          painFlag: false,
        },
      ],
    };
    const summary = buildSessionDetailSummary(withWarmup, unitSettings);
    const effectiveBefore = buildEffectiveVolumeSummary([withWarmup]);
    const e1rmBefore = buildE1RMProfile([withWarmup], 'bench-press').best?.e1rmKg;

    expect(summary.warmupSetCount).toBe(1);
    expect(summary.workingSetCount).toBe(3);
    expect(summary.workingVolumeKg).toBeGreaterThan(0);
    expect(summary.totalDisplayVolume).toContain('kg');

    const warmupEdited = {
      ...withWarmup,
      focusWarmupSetLogs: withWarmup.focusWarmupSetLogs?.map((set) => ({ ...set, weight: 40, actualWeightKg: 40 })),
    };
    const warmupSummary = buildSessionDetailSummary(warmupEdited, unitSettings);
    expect(warmupSummary.warmupVolumeKg).toBeGreaterThan(summary.warmupVolumeKg);
    expect(buildEffectiveVolumeSummary([warmupEdited]).effectiveSets).toBe(effectiveBefore.effectiveSets);
    expect(buildE1RMProfile([warmupEdited], 'bench-press').best?.e1rmKg).toBe(e1rmBefore);

    const formalEdited = markSessionEdited(
      updateSessionSet(withWarmup, 'bench-press', 'bench-press-1', { weightKg: 90, reps: 8, rir: 2 }),
      ['sets'],
      '历史训练详情修正',
    );
    expect(formalEdited.editedAt).toBeTruthy();
    expect(formalEdited.editHistory?.[0].fields).toContain('sets');
    expect(sessionVolume(formalEdited)).toBeGreaterThan(sessionVolume(withWarmup));
    expect(number(buildSessionDetailSummary(formalEdited, unitSettings).workingVolumeKg)).toBeGreaterThan(summary.workingVolumeKg);
  });

  it('keeps DataHealth low-noise with the top three issues visible first', () => {
    const vm = buildDataHealthViewModel({
      status: 'has_errors',
      summary: 'summary cache mismatch',
      issues: [
        dataHealthIssue('info-one', 'info'),
        dataHealthIssue('warning-one', 'warning'),
        dataHealthIssue('error-one', 'error'),
        dataHealthIssue('warning-two', 'warning'),
      ],
    });

    expect(vm.primaryIssues).toHaveLength(3);
    expect(vm.secondaryIssues).toHaveLength(1);
    expect(vm.primaryIssues[0].severityLabel).toBe('需要处理');
    expect(vm.primaryIssues.map((issue) => issue.title).join(' ')).not.toMatch(/summary cache mismatch|undefined|null/);
  });
});
