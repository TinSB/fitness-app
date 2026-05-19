import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { resolveFocusModeInteractionState, type FocusModeInteractionInput } from '../src/engines/focusModeInteractionState';
import type { FocusTrainingStep } from '../src/engines/focusModeStateEngine';
import { TrainingFocusView, buildFocusPainBoundaryNotice } from '../src/features/TrainingFocusView';
import type { ActualSetDraft, UnitSettings } from '../src/models/training-model';
import { makeExercise, makeFocusSession } from './focusModeFixtures';

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');
const noop = (..._args: unknown[]) => undefined;
const setStateNoop = (() => undefined) as React.Dispatch<React.SetStateAction<number>>;
const lbToKg = (lb: number) => lb * 0.45359237;
const unitSettings: UnitSettings = {
  weightUnit: 'lb',
  defaultIncrementKg: 2.5,
  defaultIncrementLb: 5,
  customIncrementsKg: [],
  customIncrementsLb: [],
};

const visibleText = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const renderFocusHtml = () =>
  renderToStaticMarkup(
    React.createElement(TrainingFocusView, {
      session: makeFocusSession([
        {
          ...makeExercise('bench-press', 1, 0, 1),
          name: '平板卧推',
          warmupSets: [{ weight: lbToKg(17), reps: 10 }],
          sets: [{ id: 'bench-working', weight: lbToKg(135), reps: 5, rir: 2, done: false, painFlag: false, type: 'top' }],
        },
      ]),
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

const baseInput: FocusModeInteractionInput = {
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

describe('UI-OS R8.7D Focus More menu and microcopy final purge', () => {
  it('keeps the default More menu to approved Focus items only', () => {
    const focusSource = read('src/features/TrainingFocusView.tsx');
    const start = focusSource.indexOf('const focusSecondaryActions');
    const end = focusSource.indexOf('const focusActionSummary');
    const actionSource = focusSource.slice(start, end);

    expect(actionSource).toContain("label: '替代动作'");
    expect(actionSource).toContain("label: '标记不适'");
    expect(actionSource).toContain("label: '动作顺序'");
    expect(actionSource).not.toContain("label: '复制上组'");
    expect(actionSource).not.toContain("label: '记录详情'");
    expect(actionSource).not.toContain("label: '查看详情'");
    expect(actionSource).not.toContain("label: '跳过'");
  });

  it('keeps interaction-state default secondary actions aligned with the approved More menu', () => {
    const state = resolveFocusModeInteractionState(baseInput);
    expect(state.secondaryActions.map((action) => action.label)).toEqual(['替代动作', '标记不适', '动作顺序']);
    expect(state.secondaryActions.map((action) => action.label)).not.toContain('查看详情');
  });

  it('renders ordinary Focus without long explanations or recommendation detail prompts by default', () => {
    const html = renderFocusHtml();
    const text = visibleText(html);

    expect(text).toContain('本组建议');
    expect(text).toContain('重量详情');
    expect(text).not.toContain('复制上组');
    expect(text).not.toContain('记录详情');
    expect(text).not.toContain('查看详情');
    expect(text).not.toContain('依据');
    expect(text).not.toContain('需要手动确认');
    expect(text).not.toContain('实际记录通过底部动作栏填写');
    expect(text).not.toContain('选择本次实际执行动作，保留当前模板位置');
    expect(text).not.toContain('理论计算');
    expect(text).not.toContain('实际可做');
  });

  it('keeps weight details collapsed and hides theoretical debug from default Focus source', () => {
    const focusSource = read('src/features/TrainingFocusView.tsx');
    const displaySource = read('src/ui/EquipmentAwareLoadDisplay.tsx');

    expect(renderFocusHtml()).toContain('data-equipment-weight-details="collapsed"');
    expect(focusSource).not.toContain('showDetails');
    expect(displaySource).toContain("split('；理论计算')");
    expect(displaySource).not.toContain('displayResult.reasonLabel');
  });

  it('allows a meaningful severe state notice without ordinary explanatory paragraph copy', () => {
    const currentStep: FocusTrainingStep = {
      id: 'bench-warmup-1',
      exerciseId: 'bench-press',
      exerciseIndex: 0,
      blockType: 'main',
      exerciseName: '平板卧推',
      stepType: 'warmup',
      setIndex: 0,
      totalSetsForStepType: 1,
      label: '热身 1',
      plannedWeight: lbToKg(45),
      plannedReps: 10,
      source: 'warmup',
    };
    const actualDraft: ActualSetDraft = {
      stepId: 'bench-warmup-1',
      actualWeightKg: lbToKg(45),
      displayWeight: 45,
      displayUnit: 'lb',
      actualReps: 10,
      painFlag: true,
      source: 'manual',
    };

    expect(buildFocusPainBoundaryNotice({ currentStep, actualDraft })).toEqual({ title: '本组已标记不适' });
  });
});
