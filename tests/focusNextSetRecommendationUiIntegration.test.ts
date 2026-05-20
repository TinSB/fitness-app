import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { getCurrentFocusStep, type FocusTrainingStep } from '../src/engines/focusModeStateEngine';
import type { FocusNextSetRecommendation } from '../src/engines/focusNextSetRecommendationEngine';
import {
  buildFocusNextSetRecommendationDraftUpdate,
  buildFocusNextSetRecommendationViewModel,
  canApplyFocusNextSetRecommendation,
  isFocusNextSetRecommendationVisible,
  TrainingFocusView,
} from '../src/features/TrainingFocusView';
import type { TrainingSession, UnitSettings } from '../src/models/training-model';
import { attachSupportBlocks, makeExercise, makeFocusSession } from './focusModeFixtures';

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

const makeSession = (): TrainingSession =>
  makeFocusSession([
    {
      ...makeExercise('bench-press', 2),
      name: 'Bench Press',
      sets: [
        { id: 'bench-1', weight: lbToKg(135), reps: 8, rir: 2, done: false, painFlag: false, type: 'working' },
        { id: 'bench-2', weight: lbToKg(135), reps: 8, rir: 2, done: false, painFlag: false, type: 'working' },
      ],
    },
  ]);

const makeRecommendation = (
  currentStep: FocusTrainingStep,
  overrides: Partial<FocusNextSetRecommendation> = {},
): FocusNextSetRecommendation => ({
  id: `focus-next-set:${currentStep.id}`,
  scope: 'set',
  level: 2,
  recommendationKind: 'increase_load',
  targetExerciseId: currentStep.exerciseId,
  targetSetId: currentStep.id,
  actionableLoadKg: lbToKg(140),
  plannedReps: 8,
  confidence: 'high',
  reasonCodes: ['reps_above_plan'],
  userMessage: 'unused internal message',
  riskFlags: [],
  requiresConfirmation: false,
  blockedReasons: [],
  sourceEngineIds: ['focus-next-set-recommendation-v1'],
  createdAt: '2026-05-19T12:00:00.000Z',
  ...overrides,
});

const renderFocus = (session: TrainingSession, recommendation: FocusNextSetRecommendation | null = null) =>
  renderToStaticMarkup(
    React.createElement(TrainingFocusView, {
      session,
      unitSettings,
      nextSetRecommendation: recommendation,
      onApplyNextSetRecommendation: noop,
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

describe('Focus next-set recommendation UI integration', () => {
  it('renders a compact next-set recommendation when the target matches the current step', () => {
    const session = makeSession();
    const currentStep = getCurrentFocusStep(session);
    const html = renderFocus(session, makeRecommendation(currentStep));
    const text = visibleText(html);

    expect(html).toContain('data-focus-next-set-recommendation="compact"');
    expect(text).toContain('下一组建议');
    expect(text).toContain('加重到 140 lb × 8');
    expect(html).toContain('data-focus-next-set-apply="safe-prefill"');
    expect(text).toContain('套用');
  });

  it('hides stale or support-step recommendations', () => {
    const session = makeSession();
    const currentStep = getCurrentFocusStep(session);
    const stale = makeRecommendation(currentStep, { targetSetId: 'main:bench-press:working:9' });
    const supportSession = attachSupportBlocks(makeFocusSession([makeExercise('bench-press', 1)]));
    const supportStep = getCurrentFocusStep(supportSession);
    const supportRecommendation = makeRecommendation(supportStep, { targetSetId: supportStep.id, targetExerciseId: supportStep.exerciseId });

    expect(renderFocus(session, stale)).not.toContain('data-focus-next-set-recommendation="compact"');
    expect(renderFocus(supportSession, supportRecommendation)).not.toContain('data-focus-next-set-recommendation="compact"');
    expect(isFocusNextSetRecommendationVisible(currentStep, stale, false)).toBe(false);
    expect(isFocusNextSetRecommendationVisible(supportStep, supportRecommendation, false)).toBe(false);
  });

  it('hides direct prefill for risk recommendations', () => {
    const session = makeSession();
    const currentStep = getCurrentFocusStep(session);
    const risk = makeRecommendation(currentStep, {
      level: 1,
      recommendationKind: 'extend_rest',
      actionableLoadKg: undefined,
      plannedReps: undefined,
      requiresConfirmation: true,
      riskFlags: ['near_failure'],
      reasonCodes: ['near_failure'],
    });
    const html = renderFocus(session, risk);
    const text = visibleText(html);

    expect(html).toContain('data-focus-next-set-recommendation="compact"');
    expect(text).toContain('接近力竭，延长休息');
    expect(html).not.toContain('data-focus-next-set-apply="safe-prefill"');
    expect(canApplyFocusNextSetRecommendation(risk)).toBe(false);
  });

  it('builds a safe draft update without completing or finishing the set', () => {
    const session = makeSession();
    const recommendation = makeRecommendation(getCurrentFocusStep(session));
    const update = buildFocusNextSetRecommendationDraftUpdate(recommendation, unitSettings);

    expect(update).toEqual({
      actualWeightKg: recommendation.actionableLoadKg,
      displayWeight: 140,
      displayUnit: 'lb',
      actualReps: 8,
      source: 'prescription',
    });
    expect(JSON.stringify(update)).not.toContain('done');
    expect(JSON.stringify(update)).not.toContain('completedAt');
  });

  it('keeps user-facing next-set copy free of technical wording', () => {
    const session = makeSession();
    const currentStep = getCurrentFocusStep(session);
    const html = renderFocus(session, makeRecommendation(currentStep));
    const text = visibleText(html);
    const source = readFileSync(resolve(process.cwd(), 'src/features/TrainingFocusView.tsx'), 'utf8');
    const visibleStringLiterals = Array.from(source.matchAll(/['"`]([^'"`]*?(?:下一组建议|套用|查看原因|保持|加重|降重|减少次数|延长休息|先停止|先不冲重量)[^'"`]*)['"`]/gu)).map(
      (match) => match[1],
    );
    const forbidden = ['引擎', '算法', '自动化', '模型', 'AI 教练', '系统判断', '智能推荐', '决策系统', 'engine', 'algorithm', 'automation', 'model', 'AI coach', 'intelligent recommendation', 'decision system'];

    for (const copy of [text, ...visibleStringLiterals]) {
      for (const token of forbidden) {
        expect(copy).not.toContain(token);
      }
    }
    expect(buildFocusNextSetRecommendationViewModel(makeRecommendation(currentStep), unitSettings)?.title).toBe('下一组建议');
  });
});
