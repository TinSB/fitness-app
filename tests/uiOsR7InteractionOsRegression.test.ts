import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildDataHealthClaritySummary } from '../src/engines/dataHealthClaritySummary';
import { applySuggestedFocusStepWithResult, getActualSetDraft, getCurrentFocusStep } from '../src/engines/focusModeStateEngine';
import { resolveFocusModeInteractionState, type FocusModeInteractionInput } from '../src/engines/focusModeInteractionState';
import { buildHistoryCalendarSummary } from '../src/engines/historyCalendarSummary';
import { buildProgressClaritySummary } from '../src/engines/progressClaritySummary';
import { buildTodayDecisionSurface } from '../src/engines/todayDecisionSurface';
import { convertKgToDisplayWeight } from '../src/engines/unitConversionEngine';
import { makeSession } from './fixtures';
import { makeExercise, makeFocusSession } from './focusModeFixtures';

const read = (path: string) => readFileSync(path, 'utf8');
const lbToKg = (lb: number) => lb * 0.45359237;

const baseFocusInput: FocusModeInteractionInput = {
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

const resolve = (overrides: Partial<FocusModeInteractionInput>) =>
  resolveFocusModeInteractionState({ ...baseFocusInput, ...overrides });

const makeBenchWarmupSession = () =>
  makeFocusSession([
    {
      ...makeExercise('bench-press', 1, 0, 1),
      name: 'Bench Press',
      warmupSets: [{ weight: lbToKg(17), reps: 10 }],
      sets: [{ id: 'bench-working', weight: lbToKg(135), reps: 5, rir: 2, done: false, painFlag: false, type: 'top' }],
    },
  ]);

describe('UI-OS R7 Interaction OS regression lock', () => {
  it('locks Focus Mode primary action labels away from old complete-set copy', () => {
    const correction = resolve({ exerciseState: 'correction_exercise', setState: 'correction_set', isFormalWorkingSet: false });
    const mobility = resolve({ exerciseState: 'mobility_exercise', setState: 'mobility_task', isFormalWorkingSet: false });
    const skip = resolve({ exerciseState: 'skipped_exercise', setState: 'skipped', hasSkipReason: true, isFormalWorkingSet: false });

    expect(correction.primaryActionLabel).toBe('完成纠偏');
    expect(mobility.primaryActionLabel).toBe('完成动作');
    expect(skip.primaryActionLabel).toBe('确认跳过');
    for (const state of [correction, mobility, skip]) {
      expect(state.primaryActionLabel).not.toBe('完成一组');
      expect(state.shouldHideBottomNav).toBe(true);
      expect(state.sourceOfTruthChanged).toBe(false);
      expect(state.trainingAlgorithmChanged).toBe(false);
    }
  });

  it('locks one dominant Focus action, second confirmation, bottom nav hiding, and actual record sheet', () => {
    const endRequested = resolve({ sessionState: 'session_end_requested' });
    const focusSource = read('src/features/TrainingFocusView.tsx');
    const appSource = read('src/App.tsx');
    const actionBarSource = read('src/uiOs/training/FocusModeActionBar.tsx');
    const secondaryActionsSource = read('src/uiOs/training/FocusModeSecondaryActions.tsx');

    expect(endRequested.primaryActionLabel).toBe('确认结束训练');
    expect(endRequested.requiresSecondConfirmation).toBe(true);
    expect(appSource).toContain('immersive={Boolean(useFocusTrainingShell)}');
    expect(focusSource).toContain('FocusModeActionBar');
    expect(focusSource).toContain('FocusActualSetRecordSheet');
    expect(actionBarSource).toContain('data-focus-mode-action-bar="one-dominant-primary"');
    expect(secondaryActionsSource).toContain('data-focus-secondary-actions="visual-secondary"');
  });

  it('locks apply suggestion to feasible equipment-aware weight only', () => {
    const applied = applySuggestedFocusStepWithResult(makeBenchWarmupSession(), 0);
    const draft = getActualSetDraft(applied.session, getCurrentFocusStep(applied.session));

    expect(applied.actionResult).toMatchObject({ ok: true, changed: true });
    expect(convertKgToDisplayWeight(draft?.actualWeightKg, 'lb')).toBe(45);
    expect(draft?.actualReps).toBeUndefined();
    expect(draft?.actualRir).toBeUndefined();
    expect(applied.session.exercises[0].warmupSets[0].done).not.toBe(true);
  });

  it('locks Today decision surface hierarchy and keeps diagnostics secondary', () => {
    const decision = buildTodayDecisionSurface({ recommendedFocus: '推 A', sourceOfTruthClear: true });
    const severe = buildTodayDecisionSurface({
      recommendedFocus: '推 A',
      severeDataHealthBlocker: { title: '严重记录问题', message: '先检查严重问题。' },
    });
    const todaySource = read('src/features/TodayView.tsx');

    expect(decision.decisionState).toBe('train_recommended');
    expect(decision.primaryActionLabel).toBe('开始今天训练');
    expect(severe.showFullDiagnostics).toBe(false);
    expect(todaySource.indexOf('TodayDecisionHero')).toBeLessThan(todaySource.indexOf('TodayFocusOverrideControl'));
    expect(todaySource).toContain('TodayReadinessSummary');
    expect(todaySource).not.toContain('HealthDataPanel');
  });

  it('locks History calendar frequency before recent sessions and PR/e1RM quick access', () => {
    const result = buildHistoryCalendarSummary({
      sessions: [
        makeSession({
          id: 'bench-1',
          date: '2026-05-04',
          templateId: 'push-a',
          exerciseId: 'bench-press',
          setSpecs: [{ weight: 80, reps: 5, rir: 2, techniqueQuality: 'good' }],
        }),
        makeSession({
          id: 'squat-1',
          date: '2026-05-06',
          templateId: 'legs-a',
          exerciseId: 'squat',
          setSpecs: [{ weight: 100, reps: 5, rir: 2, techniqueQuality: 'good' }],
        }),
      ],
      selectedDate: '2026-05-06',
      today: '2026-05-08',
      month: '2026-05',
    });
    const recordSource = read('src/features/RecordView.tsx');

    expect(result.thisWeekTrainingDays).toBe(2);
    expect(result.thisMonthTrainingDays).toBe(2);
    expect(result.recentFourWeekAverage).toBeGreaterThan(0);
    expect(result.prQuickAccessItems.some((item) => item.exerciseId === 'bench-press')).toBe(true);
    const historyRenderSource = recordSource.slice(recordSource.indexOf('aria-label="History calendar-first surface"'));
    expect(historyRenderSource.indexOf('HistoryFrequencySummary')).toBeLessThan(historyRenderSource.indexOf('TrainingFrequencyCalendar'));
    expect(historyRenderSource.indexOf('TrainingFrequencyCalendar')).toBeLessThan(historyRenderSource.indexOf('RecentTrainingTimeline'));
    expect(recordSource).toContain('PrErmQuickAccessCards');
  });

  it('locks Progress Data Health and Settings clarity surfaces', () => {
    const progress = buildProgressClaritySummary({
      dataCoverageStatus: 'sufficient',
      strengthTrend: 'stable',
      recoveryPressure: 'normal',
      strengthTrendItems: [],
    });
    const dataHealth = buildDataHealthClaritySummary({ issues: [], sourceOfTruthClear: true });
    const recordSource = read('src/features/RecordView.tsx');
    const dataHealthPanelSource = read('src/uiOs/dataHealth/DataHealthClarityPanel.tsx');
    const profileSource = read('src/features/ProfileView.tsx');

    expect(progress.heroTitle).toContain('稳定');
    expect(progress.calculationChanged).toBe(false);
    expect(dataHealth.repairActionAllowed).toBe(false);
    expect(dataHealth.externalUploadAllowed).toBe(false);
    expect(recordSource).toContain('ProgressInsightHero');
    expect(recordSource).toContain('DataHealthClarityPanel');
    expect(dataHealthPanelSource).toContain('不提供自动修复');
    expect(dataHealthPanelSource).not.toContain('/data-health/repair/apply');
    expect(profileSource).toContain('SettingsControlCenter');
    expect(profileSource).toContain('ThemeSettingsPanel');
    expect(profileSource).toContain('CloudCandidateSettingsPanel');
  });

  it('locks dark training flow away from uncontrolled legacy white cards', () => {
    const trainingSources = [
      read('src/features/TrainingFocusView.tsx'),
      read('src/features/TrainingView.tsx'),
      read('src/uiOs/training/TrainingFocusHero.tsx'),
      read('src/uiOs/training/EquipmentAwareLoadCard.tsx'),
      read('src/uiOs/training/FocusModeActionBar.tsx'),
    ].join('\n');

    expect(trainingSources).toContain('GlassCard');
    expect(trainingSources).toContain('EquipmentAwareLoadCard');
    expect(trainingSources).not.toMatch(/bg-white\s+text-black|text-black\s+bg-white/);
  });
});
