import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { resolveActionableLoadContract } from '../src/engines/actionableLoadContract';
import { applySuggestedFocusStepWithResult, getActualSetDraft, getCurrentFocusStep } from '../src/engines/focusModeStateEngine';
import { resolveFocusModeInteractionState, type FocusModeInteractionInput } from '../src/engines/focusModeInteractionState';
import { buildPracticalWarmupPolicy } from '../src/engines/practicalWarmupPolicy';
import { detectSetAnomalies } from '../src/engines/setAnomalyEngine';
import { convertKgToDisplayWeight } from '../src/engines/unitConversionEngine';
import { TrainingFocusView } from '../src/features/TrainingFocusView';
import type { TrainingSession, UnitSettings } from '../src/models/training-model';
import { makeExercise, makeFocusSession } from './focusModeFixtures';

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');
const lbToKg = (lb: number) => lb * 0.45359237;
const noop = (..._args: unknown[]) => undefined;
const setStateNoop = (() => undefined) as React.Dispatch<React.SetStateAction<number>>;
const unitSettings: UnitSettings = {
  weightUnit: 'lb',
  defaultIncrementKg: 2.5,
  defaultIncrementLb: 5,
  customIncrementsKg: [],
  customIncrementsLb: [],
};

const visibleText = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const renderFocusHtml = (session: TrainingSession) =>
  renderToStaticMarkup(
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

const belowBarBenchSession = () =>
  makeFocusSession([
    {
      ...makeExercise('bench-press', 1, 0, 1),
      id: 'bench-press',
      baseId: 'bench-press',
      name: 'Bench Press',
      warmupSets: [{ weight: lbToKg(27), reps: 10 }],
      sets: [{ id: 'bench-working', weight: lbToKg(135), reps: 5, rir: 2, done: false, painFlag: false, type: 'top' }],
    },
  ]);

const baseInteractionInput: FocusModeInteractionInput = {
  sessionState: 'active_session',
  exerciseState: 'active_exercise',
  setState: 'working_set',
  recommendationState: 'feasible_load_ready',
  safetyState: 'local_ok',
  hasFeasibleLoad: true,
  hasAppliedSuggestion: false,
  hasActualInput: false,
  hasSkipReason: false,
  hasDiscomfort: false,
  canContinue: true,
  canComplete: true,
  canRecord: true,
  canApplySuggestion: true,
  isFormalWorkingSet: true,
  isCorrectionOrMobility: false,
  sourceOfTruthClear: true,
};

describe('UI-OS R8.7E Focus final acceptance regression lock', () => {
  it('locks actionable 45 lb over raw theoretical 27 lb for display apply and validation', () => {
    const contract = resolveActionableLoadContract({
      exerciseName: 'Bench Press',
      rawTheoreticalLoadKg: lbToKg(27),
      plannedReps: 10,
      setPurpose: 'warmup',
      unitSettings,
      showTheoreticalDetail: true,
    });
    const session = belowBarBenchSession();
    const html = renderFocusHtml(session);
    const applied = applySuggestedFocusStepWithResult(session, 0);
    const draft = getActualSetDraft(applied.session, getCurrentFocusStep(applied.session));
    const anomalies = detectSetAnomalies({
      currentDraft: {
        exerciseId: 'bench-press',
        stepId: 'main:bench-press:warmup:0',
        stepType: 'warmup',
        setType: 'warmup',
        isWarmup: true,
        actualWeightKg: lbToKg(45),
        actualReps: 10,
        displayWeight: 45,
        displayUnit: 'lb',
        source: 'prescription',
      },
      exerciseId: 'bench-press',
      previousSets: [],
      unitSettings,
      plannedPrescription: {
        rawTheoreticalWeightKg: lbToKg(27),
        plannedWeightKg: lbToKg(27),
        actionableWeightKg: lbToKg(45),
        validationBaselineKg: lbToKg(45),
        plannedReps: 10,
        repMax: 10,
        stepType: 'warmup',
        setType: 'warmup',
        isWarmup: true,
      },
    });

    expect(convertKgToDisplayWeight(contract.rawTheoreticalLoadKg, 'lb')).toBe(27);
    expect(convertKgToDisplayWeight(contract.actionableLoadKg, 'lb')).toBe(45);
    expect(convertKgToDisplayWeight(contract.validationBaselineKg, 'lb')).toBe(45);
    expect(visibleText(html)).toContain('空杆 45 lb × 10');
    expect(convertKgToDisplayWeight(draft?.actualWeightKg, 'lb')).toBe(45);
    expect(draft?.actualReps).toBe(10);
    expect(draft?.actualRir).toBeUndefined();
    expect(applied.actionResult.changed).toBe(true);
    expect(applied.actionResult.message).toBe('已套用建议。');
    expect(getCurrentFocusStep(applied.session).id).toBe(getCurrentFocusStep(session).id);
    expect(anomalies.filter((item) => item.requiresConfirmation)).toEqual([]);
  });

  it('locks applied current record and primary action without duplicate recommendation load', () => {
    const applied = applySuggestedFocusStepWithResult(belowBarBenchSession(), 0).session;
    const html = renderFocusHtml(applied);
    const text = visibleText(html);

    expect(text).toContain('当前记录：45 lb × 10 次');
    expect(text).toContain('完成一组');
    expect((html.match(/data-focus-primary-load-label="true"/g) || [])).toHaveLength(1);
    expect(text).not.toContain('27 lb × 10');
    expect(text).not.toContain('理论计算');
  });

  it('locks practical warmups to normal count and rep rules', () => {
    const normal = buildPracticalWarmupPolicy({
      workWeightKg: lbToKg(225),
      exercise: { id: 'squat', name: 'Squat', kind: 'compound', fatigueCost: 'high' },
    });

    expect(normal.warmupSets.length).toBeGreaterThan(0);
    expect(normal.warmupSets.length).toBeLessThanOrEqual(3);
    expect(normal.warmupSets.map((set) => set.reps)).not.toContain(2);
    expect(normal.warmupSets.map((set) => set.reps)).not.toContain(1);
    expect(normal.usesEquipmentAwareFeasibleLoads).toBe(true);
  });

  it('locks the approved More menu and one primary action rule', () => {
    const state = resolveFocusModeInteractionState(baseInteractionInput);
    const focusSource = read('src/features/TrainingFocusView.tsx');
    const start = focusSource.indexOf('const focusSecondaryActions');
    const end = focusSource.indexOf('const focusActionSummary');
    const actionSource = focusSource.slice(start, end);

    expect(state.secondaryActions.map((action) => action.label)).toEqual(['替代动作', '标记不适', '动作顺序']);
    expect(actionSource).toContain("label: '替代动作'");
    expect(actionSource).toContain("label: '标记不适'");
    expect(actionSource).toContain("label: '动作顺序'");
    expect(actionSource).not.toContain("label: '记录详情'");
    expect(actionSource).not.toContain("label: '查看详情'");
    expect(actionSource).not.toContain("label: '复制上组'");
  });

  it('locks one-layer dark sheet behavior and clean Focus bottom safe area', () => {
    const sources = [
      read('src/ui/BottomSheet.tsx'),
      read('src/uiOs/surfaces/BottomSheet.tsx'),
      read('src/uiOs/training/FocusModeSecondaryActions.tsx'),
      read('src/uiOs/training/FocusModeActionBar.tsx'),
      read('src/features/TrainingFocusView.tsx'),
    ].join('\n');
    const focusSource = read('src/features/TrainingFocusView.tsx');
    const endSheetSource = focusSource.slice(focusSource.indexOf('const renderEndSessionSheet'), focusSource.indexOf('const renderCompletedState'));

    expect(sources).toContain('data-bottom-sheet-backdrop="dismiss"');
    expect(sources).toContain('data-bottom-sheet-handle="dismiss"');
    expect(sources).toContain('data-focus-more-backdrop="dismiss"');
    expect(sources).toContain('data-focus-more-handle="dismiss"');
    expect(sources).toContain('title="仍有未完成动作，是否结束训练？"');
    expect(sources).toContain('data-focus-bottom-safe-area="compact"');
    expect(sources).not.toContain('title="结束训练"');
    expect(sources).not.toContain('结束训练需要再次确认');
    expect(sources).not.toContain('实际记录通过底部动作栏填写');
    expect(endSheetSource).not.toContain('需要手动确认');
  });
});
