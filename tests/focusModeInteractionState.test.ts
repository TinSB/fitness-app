import { describe, expect, it } from 'vitest';
import {
  resolveFocusModeInteractionState,
  type FocusModeInteractionInput,
} from '../src/engines/focusModeInteractionState';

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

const resolve = (overrides: Partial<FocusModeInteractionInput>) =>
  resolveFocusModeInteractionState({ ...baseInput, ...overrides });

describe('Focus Mode interaction state resolver', () => {
  it('maps session entry states to one dominant primary action', () => {
    expect(resolve({ sessionState: 'no_session' }).primaryActionLabel).toBe('开始今天训练');
    expect(resolve({ sessionState: 'planned_session_ready' }).primaryActionLabel).toBe('开始训练');
    expect(resolve({ sessionState: 'unfinished_session' }).primaryActionLabel).toBe('继续训练');
  });

  it('records normal warmup and working sets before actual input', () => {
    expect(resolve({ setState: 'warmup_set', hasActualInput: false }).primaryActionLabel).toBe('记录本组');
    expect(resolve({ setState: 'working_set', hasActualInput: false }).primaryActionLabel).toBe('记录本组');
    expect(resolve({ setState: 'working_set', hasActualInput: false }).shouldOpenActualRecordSheet).toBe(true);
  });

  it('completes only after suggestion has been applied and input is ready', () => {
    const state = resolve({
      setState: 'suggestion_applied',
      hasAppliedSuggestion: true,
      hasActualInput: true,
    });

    expect(state.primaryActionLabel).toBe('完成一组');
    expect(state.primaryActionKind).toBe('complete_set');
  });

  it('uses correction and mobility labels without formal set count', () => {
    const correction = resolve({
      exerciseState: 'correction_exercise',
      setState: 'correction_set',
      isCorrectionOrMobility: true,
      isFormalWorkingSet: false,
    });
    const mobility = resolve({
      exerciseState: 'mobility_exercise',
      setState: 'mobility_task',
      isCorrectionOrMobility: true,
      isFormalWorkingSet: false,
    });

    expect(correction.primaryActionLabel).toBe('完成纠偏');
    expect(correction.primaryActionLabel).not.toBe('完成一组');
    expect(correction.shouldCountAsFormalSet).toBe(false);
    expect(mobility.primaryActionLabel).toBe('完成动作');
    expect(mobility.primaryActionLabel).not.toBe('完成一组');
    expect(mobility.shouldCountAsFormalSet).toBe(false);
  });

  it('uses skip and discomfort actions without completing a set', () => {
    const skipped = resolve({
      exerciseState: 'skipped_exercise',
      setState: 'skipped',
      hasSkipReason: true,
      isFormalWorkingSet: false,
    });
    const discomfort = resolve({ exerciseState: 'discomfort_flagged', hasDiscomfort: true });

    expect(skipped.primaryActionLabel).toBe('确认跳过');
    expect(skipped.secondaryActions.map((action) => action.label)).toContain('继续训练');
    expect(skipped.primaryActionLabel).not.toBe('完成一组');
    expect(discomfort.primaryActionLabel).toBe('选择处理方式');
  });

  it('protects unclear source and session end confirmation states', () => {
    const sourceUnclear = resolve({ safetyState: 'source_unclear', sourceOfTruthClear: false });
    const endRequested = resolve({ sessionState: 'session_end_requested' });

    expect(sourceUnclear.primaryActionLabel).toBe('回到本地模式');
    expect(sourceUnclear.warning).toContain('数据来源');
    expect(sourceUnclear.canApplySuggestion).toBe(false);
    expect(endRequested.primaryActionLabel).toBe('确认结束训练');
    expect(endRequested.requiresSecondConfirmation).toBe(true);
    expect(endRequested.secondaryActions.map((action) => action.label)).toContain('继续训练');
  });

  it('keeps resolver side-effect flags false', () => {
    const state = resolve({ setState: 'working_set' });

    expect(state.sourceOfTruthChanged).toBe(false);
    expect(state.trainingAlgorithmChanged).toBe(false);
    expect(state.shouldHideBottomNav).toBe(true);
  });
});
