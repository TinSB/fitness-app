import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildPrs } from '../src/engines/analytics';
import { buildE1RMProfile } from '../src/engines/e1rmEngine';
import { buildEffectiveVolumeSummary } from '../src/engines/effectiveSetEngine';
import { sessionCompletedSets, sessionVolume } from '../src/engines/engineUtils';
import { applyExerciseReplacement, buildReplacementOptions } from '../src/engines/replacementEngine';
import { markSessionEdited, updateSessionSet, validateSessionEdit } from '../src/engines/sessionEditEngine';
import { formatTrainingVolume, parseDisplayWeightToKg } from '../src/engines/unitConversionEngine';
import { buildTodayViewModel } from '../src/presenters/todayPresenter';
import type { TodayTrainingState } from '../src/engines/todayStateEngine';
import type { TrainingSession, UnitSettings } from '../src/models/training-model';
import { TrainingFocusView } from '../src/features/TrainingFocusView';
import { attachSupportBlocks, makeExercise as makeFocusExercise, makeFocusSession } from './focusModeFixtures';
import { getTemplate, makeSession } from './fixtures';

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

const completedTodayState: TodayTrainingState = {
  status: 'completed',
  date: '2026-04-28',
  completedSessionIds: ['done'],
  lastCompletedSessionId: 'done',
  primaryAction: 'view_summary',
};

const renderFocus = (session: TrainingSession) =>
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

describe('real workout regression coverage', () => {
  it('uses one nextSuggestion source in completed Today state', () => {
    const vm = buildTodayViewModel({
      todayState: completedTodayState,
      selectedTemplate: getTemplate('legs-a'),
      completedTemplateName: 'Legs A',
      nextSuggestion: getTemplate('pull-a'),
    });

    expect(vm.nextSuggestion.templateId).toBe('pull-a');
    expect(vm.currentTrainingName).toBe('拉 A');
    expect(vm.nextSuggestion.description).toContain('拉 A');
    expect(vm.nextSuggestion.description).not.toContain('腿 A');
  });

  it('keeps Summary metrics derived from the same saved set logs', () => {
    const session = makeSession({
      id: 'summary-sets',
      date: '2026-04-28',
      templateId: 'legs-a',
      exerciseId: 'squat',
      setSpecs: [
        { weight: 100, reps: 5, rir: 2, techniqueQuality: 'good' },
        { weight: 100, reps: 5, rir: 2, techniqueQuality: 'good' },
        { weight: 100, reps: 5, rir: 2, techniqueQuality: 'good' },
      ],
    }) as TrainingSession & { completedSets?: number; totalVolumeKg?: number };
    session.completedSets = 0;
    session.totalVolumeKg = 0;

    expect(sessionCompletedSets(session)).toBe(3);
    expect(sessionVolume(session)).toBeGreaterThan(0);
    expect(buildEffectiveVolumeSummary([session]).completedSets).toBe(3);
    expect(formatTrainingVolume(sessionVolume(session), { ...unitSettings, weightUnit: 'lb' })).toContain('lb');
    expect(formatTrainingVolume(sessionVolume(session), { ...unitSettings, weightUnit: 'lb' })).not.toContain('kg');
  });

  it('keeps Focus replacement entry visible for squat, bench, and support steps', () => {
    const squatText = renderFocus(makeFocusSession([makeFocusExercise('squat', 2)]));
    const benchText = renderFocus(makeFocusSession([makeFocusExercise('bench-press', 2)]));
    const supportSession = attachSupportBlocks(makeFocusSession([makeFocusExercise('bench-press', 1, 1)]));
    supportSession.currentFocusStepId = 'correction:corr-shoulder:wall-slide:0';
    const supportText = renderFocus(supportSession);

    [squatText, benchText, supportText].forEach((text) => {
      expect(text).toContain('复制上组');
      expect(text).toContain('标记不适');
      expect(text).toContain('替代动作');
    });
  });

  it('opens replacement sheet from real options and keeps real actualExerciseId', () => {
    const focusSource = readFileSync(resolve(process.cwd(), 'src/features/TrainingFocusView.tsx'), 'utf8');
    const bench = getTemplate('push-a').exercises.find((exercise) => exercise.id === 'bench-press');
    const squat = getTemplate('legs-a').exercises.find((exercise) => exercise.id === 'squat');
    expect(bench && buildReplacementOptions(bench).length).toBeGreaterThan(0);
    expect(squat && buildReplacementOptions(squat).length).toBeGreaterThan(0);
    expect(focusSource).toContain('setShowReplacementPicker(true)');
    expect(focusSource).toContain('当前动作暂无可替代动作。');

    const replaced = applyExerciseReplacement(
      {
        id: 'replace-real',
        date: '2026-04-28',
        templateId: 'push-a',
        templateName: '推 A',
        trainingMode: 'hybrid',
        exercises: [bench!],
      },
      0,
      'db-bench-press',
    );
    expect(replaced.exercises[0].actualExerciseId).toBe('db-bench-press');
    expect(replaced.exercises[0].actualExerciseId).not.toContain('__');
  });

  it('keeps detail headers safe-area aware without a duplicate body spacer', () => {
    const drawerSource = readFileSync(resolve(process.cwd(), 'src/ui/Drawer.tsx'), 'utf8');
    const sheetSource = readFileSync(resolve(process.cwd(), 'src/ui/BottomSheet.tsx'), 'utf8');
    const safeHeaderSource = readFileSync(resolve(process.cwd(), 'src/ui/SafeAreaHeader.tsx'), 'utf8');
    const appShellSource = readFileSync(resolve(process.cwd(), 'src/ui/AppShell.tsx'), 'utf8');
    const todaySource = readFileSync(resolve(process.cwd(), 'src/features/TodayView.tsx'), 'utf8');
    const cssSource = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');

    expect(drawerSource).toContain('SafeAreaHeader');
    expect(sheetSource).toContain('SafeAreaHeader');
    expect(safeHeaderSource).toContain('env(safe-area-inset-top)');
    expect(safeHeaderSource).toContain('aria-label={closeLabel}');
    expect(appShellSource).toContain('env(safe-area-inset-top)');
    expect(todaySource).not.toContain('pt-[calc');
    expect(cssSource).not.toContain('body {\n    padding-top: env(safe-area-inset-top)');
  });

  it('edits history records, writes audit fields, and converts lb input to kg', () => {
    const session = makeSession({
      id: 'edit-history',
      date: '2026-04-28',
      templateId: 'push-a',
      exerciseId: 'bench-press',
      setSpecs: [{ weight: 60, reps: 8, rir: 2, techniqueQuality: 'good' }],
    });
    const originalVolume = sessionVolume(session);
    const editedWeightKg = parseDisplayWeightToKg(155, 'lb');
    const edited = markSessionEdited(
      updateSessionSet(session, 'bench-press', 'bench-press-1', {
        weightKg: editedWeightKg,
        displayWeight: 155,
        displayUnit: 'lb',
        reps: 10,
        rir: 3,
        note: '补正重量和次数',
      }),
      ['sets'],
      '历史训练详情修正',
    );

    expect(validateSessionEdit(edited).valid).toBe(true);
    expect(edited.exercises[0].sets[0].actualWeightKg).toBeCloseTo(editedWeightKg);
    expect(edited.exercises[0].sets[0].displayUnit).toBe('lb');
    expect(sessionVolume(edited)).toBeGreaterThan(originalVolume);
    expect(edited.editedAt).toBeTruthy();
    expect(edited.editHistory?.[0].fields).toContain('sets');
  });

  it('recalculates analytics after edits and keeps low-confidence edits out of high-quality records', () => {
    const session = makeSession({
      id: 'edit-analytics',
      date: '2026-04-28',
      templateId: 'push-a',
      exerciseId: 'bench-press',
      setSpecs: [{ weight: 80, reps: 6, rir: 2, techniqueQuality: 'good' }],
    });
    const poor = updateSessionSet(session, 'bench-press', 'bench-press-1', {
      reps: 10,
      techniqueQuality: 'poor',
      painFlag: true,
    });

    expect(sessionVolume(poor)).toBeGreaterThan(sessionVolume(session));
    expect(buildPrs([poor]).filter((item) => item.exerciseId === 'bench-press').every((item) => item.quality !== 'high_quality')).toBe(true);
    expect(buildE1RMProfile([poor], 'bench-press').best?.confidence).not.toBe('high');
  });

  it('excludes test and excluded sessions from analytics while keeping their logs viewable', () => {
    const session = makeSession({
      id: 'excluded-visible',
      date: '2026-04-28',
      templateId: 'legs-a',
      exerciseId: 'squat',
      setSpecs: [{ weight: 100, reps: 5, rir: 2, techniqueQuality: 'good' }],
    });

    expect(sessionCompletedSets({ ...session, dataFlag: 'test' })).toBe(1);
    expect(sessionCompletedSets({ ...session, dataFlag: 'excluded' })).toBe(1);
    expect(buildEffectiveVolumeSummary([{ ...session, dataFlag: 'test' }]).completedSets).toBe(0);
    expect(buildEffectiveVolumeSummary([{ ...session, dataFlag: 'excluded' }]).completedSets).toBe(0);
  });

  it('does not pollute original exercise PR or e1RM after replacement', () => {
    const squat = getTemplate('legs-a').exercises.find((exercise) => exercise.id === 'squat')!;
    const replaced = applyExerciseReplacement(
      {
        id: 'replace-pr',
        date: '2026-04-28',
        templateId: 'legs-a',
        templateName: '腿 A',
        trainingMode: 'hybrid',
        exercises: [{ ...squat, sets: [{ id: 'set-1', type: 'top', weight: 140, reps: 5, rir: 2, done: true }] }],
      },
      0,
      'leg-press',
    );

    expect(buildE1RMProfile([replaced], 'squat').current).toBeUndefined();
    expect(buildE1RMProfile([replaced], 'leg-press').current).toBeTruthy();
    expect(buildPrs([replaced]).some((item) => item.exerciseId === 'squat')).toBe(false);
  });
});
