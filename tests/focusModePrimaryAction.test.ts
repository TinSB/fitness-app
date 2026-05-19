import { describe, expect, it } from 'vitest';
import { buildFocusModeInteractionInput, resolveFocusModeInteractionState } from '../src/engines/focusModeInteractionState';
import { getCurrentFocusStep } from '../src/engines/focusModeStateEngine';
import { attachSupportBlocks, makeExercise, makeFocusSession } from './focusModeFixtures';

describe('Focus Mode primary action map from real focus steps', () => {
  it('builds a record action for an active main working set without actual input', () => {
    const session = makeFocusSession([makeExercise('bench-press', 1)]);
    const step = getCurrentFocusStep(session);
    const input = buildFocusModeInteractionInput({
      currentStep: step,
      actualDraft: null,
      sessionComplete: false,
      isSupportStep: false,
      canCompleteCurrentStep: true,
      canApplySuggestion: true,
      hasFeasibleLoad: true,
    });

    expect(input.setState).toBe('working_set');
    expect(resolveFocusModeInteractionState(input).primaryActionLabel).toBe('记录本组');
  });

  it('builds correction and mobility actions from support steps', () => {
    const supportSession = attachSupportBlocks(makeFocusSession([makeExercise('bench-press', 1)]));
    const correctionStep = getCurrentFocusStep(supportSession);
    const correction = resolveFocusModeInteractionState(
      buildFocusModeInteractionInput({
        currentStep: correctionStep,
        actualDraft: null,
        sessionComplete: false,
        isSupportStep: true,
        blockType: 'correction',
        canCompleteCurrentStep: true,
        canApplySuggestion: false,
        hasFeasibleLoad: false,
      }),
    );
    const mobility = resolveFocusModeInteractionState(
      buildFocusModeInteractionInput({
        currentStep: { ...correctionStep, stepType: 'functional', blockType: 'functional' },
        actualDraft: null,
        sessionComplete: false,
        isSupportStep: true,
        blockType: 'functional',
        canCompleteCurrentStep: true,
        canApplySuggestion: false,
        hasFeasibleLoad: false,
      }),
    );

    expect(correction.primaryActionLabel).toBe('完成纠偏');
    expect(correction.primaryActionLabel).not.toBe('完成一组');
    expect(mobility.primaryActionLabel).toBe('完成动作');
    expect(mobility.primaryActionLabel).not.toBe('完成一组');
  });

  it('maps support skip reason to confirm skip', () => {
    const supportSession = attachSupportBlocks(makeFocusSession([makeExercise('bench-press', 1)]));
    const step = getCurrentFocusStep(supportSession);
    const state = resolveFocusModeInteractionState(
      buildFocusModeInteractionInput({
        currentStep: step,
        actualDraft: null,
        sessionComplete: false,
        isSupportStep: true,
        blockType: 'correction',
        hasSkipReason: true,
        canCompleteCurrentStep: true,
        canApplySuggestion: false,
        hasFeasibleLoad: false,
      }),
    );

    expect(state.primaryActionLabel).toBe('确认跳过');
    expect(state.primaryActionLabel).not.toBe('完成一组');
    expect(state.secondaryActions.map((action) => action.label)).toContain('继续训练');
  });
});
